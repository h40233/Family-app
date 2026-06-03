import { createNotification } from "@/server/notifications";
import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { createId, getMemoryStore, nowIso } from "@/server/store";
import type {
  Budget,
  BudgetPeriodType,
  BudgetTargetType,
  BudgetUsage,
  CreateBudgetInput,
  UpdateBudgetInput
} from "./types";

export async function listBudgets(input: {
  familyId: string;
  userId: string;
}): Promise<BudgetUsage[]> {
  if (usesDatabaseRuntime("budgets")) {
    const budgets = await prisma.budget.findMany({
      where: { familyId: input.familyId },
      orderBy: { createdAt: "asc" }
    });
    const categoryNames = await getCategoryNamesById(
      budgets
        .filter((budget) => budget.targetType === "personal_category" && budget.targetId)
        .map((budget) => budget.targetId as string)
    );

    return Promise.all(
      budgets.map((budget) =>
        toDatabaseBudgetUsage(toBudget(budget, categoryNames.get(budget.targetId ?? "")), input.userId)
      )
    );
  }

  const store = getMemoryStore();
  return store.budgets
    .filter((budget) => budget.familyId === input.familyId)
    .map((budget) => toBudgetUsage(budget, input.userId));
}

async function toDatabaseBudgetUsage(budget: Budget, userId: string): Promise<BudgetUsage> {
  const spent = await calculateDatabaseSpent(budget, userId);
  const remaining = budget.amount - spent;

  return {
    budget,
    spent,
    remaining,
    exceeded: remaining < 0
  };
}

async function calculateDatabaseSpent(budget: Budget, userId: string) {
  if (budget.targetType === "shared_fund" && budget.targetId) {
    const result = await prisma.fundTransaction.aggregate({
      where: {
        familyId: budget.familyId,
        fundId: budget.targetId,
        type: "EXPENSE",
        occurredAt: {
          gte: new Date(budget.startAt),
          lte: budget.endAt ? new Date(budget.endAt) : undefined
        }
      },
      _sum: { amount: true }
    });

    return Number(result._sum.amount ?? 0);
  }

  const transactions = await prisma.personalTransaction.findMany({
    where: {
      userId: budget.userId ?? userId,
      type: "EXPENSE",
      deletedAt: null,
      accountId:
        budget.targetType === "personal_account" && budget.targetId
          ? budget.targetId
          : undefined,
      categoryId:
        budget.targetType === "personal_category" && budget.targetId
          ? budget.targetId
          : undefined,
      occurredAt: {
        gte: new Date(budget.startAt),
        lte: budget.endAt ? new Date(budget.endAt) : undefined
      }
    },
    include: { category: true }
  });

  return transactions
    .filter((transaction) => {
      if (budget.targetType === "personal_category" && budget.category) {
        return transaction.category?.name === budget.category;
      }

      return true;
    })
    .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
}

function toBudget(budget: {
  id: string;
  familyId: string | null;
  userId: string | null;
  name: string;
  targetType: string;
  targetId: string | null;
  amount: unknown;
  periodType: string;
  startAt: Date;
  endAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}, categoryName?: string): Budget {
  return {
    id: budget.id,
    familyId: budget.familyId ?? "",
    userId: budget.userId ?? undefined,
    targetType: parseBudgetTargetType(budget.targetType),
    targetId: budget.targetId ?? undefined,
    name: budget.name,
    category: categoryName,
    amount: Number(budget.amount),
    periodType: parseBudgetPeriodType(budget.periodType),
    startAt: budget.startAt.toISOString(),
    endAt: budget.endAt?.toISOString(),
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString()
  };
}

function parseBudgetTargetType(value: string): BudgetTargetType {
  if (value === "personal_account" || value === "shared_fund") return value;
  return "personal_category";
}

function parseBudgetPeriodType(value: string): BudgetPeriodType {
  return value === "custom" ? "custom" : "monthly";
}

export async function createBudget(input: CreateBudgetInput): Promise<BudgetUsage> {
  validateBudget(input);
  const startedAt = input.startAt ?? currentMonthStart();
  const endedAt = input.endAt ?? defaultEndAt(input.periodType, startedAt);

  if (usesDatabaseRuntime("budgets")) {
    const targetId = await resolveDatabaseTargetId({
      familyId: input.familyId,
      userId: input.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      category: input.category
    });

    const budget = await prisma.budget.create({
      data: {
        familyId: input.familyId,
        userId: input.userId,
        name: input.name.trim(),
        targetType: input.targetType,
        targetId,
        amount: input.amount,
        periodType: input.periodType,
        startAt: new Date(startedAt),
        endAt: endedAt ? new Date(endedAt) : null
      }
    });

    return toDatabaseBudgetUsage(toBudget(budget, input.category?.trim() || undefined), input.userId);
  }

  const store = getMemoryStore();
  const budget: Budget = {
    id: createId("budget"),
    familyId: input.familyId,
    userId: input.userId,
    targetType: input.targetType,
    targetId: input.targetId,
    name: input.name.trim(),
    category: input.category?.trim() || undefined,
    amount: input.amount,
    periodType: input.periodType,
    startAt: startedAt,
    endAt: input.endAt ?? defaultEndAt(input.periodType, startedAt),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  store.budgets.push(budget);
  return toBudgetUsage(budget, input.userId);
}

export async function updateBudget(input: UpdateBudgetInput): Promise<BudgetUsage> {
  if (usesDatabaseRuntime("budgets")) {
    const existing = await findDatabaseBudget(input.familyId, input.budgetId);
    const merged = {
      familyId: existing.familyId ?? input.familyId,
      userId: existing.userId ?? input.userId,
      name: input.name ?? existing.name,
      targetType: input.targetType ?? parseBudgetTargetType(existing.targetType),
      targetId:
        input.targetId === undefined
          ? existing.targetId ?? undefined
          : input.targetId || undefined,
      amount: input.amount ?? Number(existing.amount),
      periodType: input.periodType ?? parseBudgetPeriodType(existing.periodType),
      startAt: input.startAt ?? existing.startAt.toISOString(),
      endAt:
        input.endAt === undefined
          ? existing.endAt?.toISOString()
          : input.endAt || undefined,
      category: input.category
    };

    validateBudget({
      familyId: merged.familyId,
      userId: input.userId,
      name: merged.name,
      targetType: merged.targetType,
      targetId: merged.targetId,
      category: input.category,
      amount: merged.amount,
      periodType: merged.periodType,
      startAt: merged.startAt,
      endAt: merged.endAt
    });

    const targetId = await resolveDatabaseTargetId({
      familyId: merged.familyId,
      userId: merged.userId,
      targetType: merged.targetType,
      targetId: merged.targetId,
      category: input.category
    });

    const updated = await prisma.budget.update({
      where: { id: existing.id },
      data: {
        name: merged.name.trim(),
        targetType: merged.targetType,
        targetId,
        amount: merged.amount,
        periodType: merged.periodType,
        startAt: new Date(merged.startAt),
        endAt: merged.endAt ? new Date(merged.endAt) : null
      }
    });

    const categoryName =
      merged.targetType === "personal_category"
        ? input.category?.trim() || (await getCategoryName(targetId))
        : undefined;

    return toDatabaseBudgetUsage(toBudget(updated, categoryName), input.userId);
  }

  const store = getMemoryStore();
  const budget = findBudget(input.familyId, input.budgetId);

  if (input.name !== undefined) budget.name = input.name.trim();
  if (input.targetType !== undefined) budget.targetType = input.targetType;
  if (input.targetId !== undefined) budget.targetId = input.targetId || undefined;
  if (input.category !== undefined) budget.category = input.category.trim() || undefined;
  if (input.amount !== undefined) budget.amount = input.amount;
  if (input.periodType !== undefined) budget.periodType = input.periodType;
  if (input.startAt !== undefined) budget.startAt = input.startAt;
  if (input.endAt !== undefined) budget.endAt = input.endAt || undefined;
  budget.updatedAt = nowIso();

  validateBudget({
    familyId: budget.familyId,
    userId: input.userId,
    name: budget.name,
    targetType: budget.targetType,
    targetId: budget.targetId,
    category: budget.category,
    amount: budget.amount,
    periodType: budget.periodType,
    startAt: budget.startAt,
    endAt: budget.endAt
  });

  const index = store.budgets.findIndex((item) => item.id === budget.id);
  store.budgets[index] = budget;
  return toBudgetUsage(budget, input.userId);
}

export async function deleteBudget(input: {
  familyId: string;
  budgetId: string;
}): Promise<{ id: string; deleted: true }> {
  if (usesDatabaseRuntime("budgets")) {
    const budget = await findDatabaseBudget(input.familyId, input.budgetId);
    await prisma.budget.delete({ where: { id: budget.id } });

    return { id: budget.id, deleted: true };
  }

  const store = getMemoryStore();
  const budget = findBudget(input.familyId, input.budgetId);
  store.budgets = store.budgets.filter((item) => item.id !== budget.id);

  return { id: budget.id, deleted: true };
}

export async function notifyBudgetOverages(input: {
  familyId: string;
  userId: string;
  accountId?: string;
  fundId?: string;
  category?: string;
}) {
  const store = getMemoryStore();
  const usages = usesDatabaseRuntime("budgets")
    ? (await listBudgets({ familyId: input.familyId, userId: input.userId }))
        .filter((usage) => budgetMatchesTransaction(usage.budget, input))
        .filter((usage) => usage.exceeded)
    : store.budgets
        .filter((budget) => budget.familyId === input.familyId)
        .filter((budget) => budgetMatchesTransaction(budget, input))
        .map((budget) => toBudgetUsage(budget, input.userId))
        .filter((usage) => usage.exceeded);

  for (const usage of usages) {
    const alreadySent = await hasBudgetOverageNotification({
      familyId: input.familyId,
      userId: input.userId,
      budgetId: usage.budget.id,
      spent: usage.spent
    });

    if (alreadySent) continue;

    await createNotification({
      userId: input.userId,
      familyId: input.familyId,
      type: "budget_exceeded",
      title: "Budget exceeded",
      body: `${usage.budget.name} is over budget by ${Math.abs(usage.remaining).toLocaleString()}.`,
      data: {
        budgetId: usage.budget.id,
        spent: usage.spent,
        remaining: usage.remaining
      }
    });
  }

  return usages;
}

function findBudget(familyId: string, budgetId: string) {
  const budget = getMemoryStore().budgets.find(
    (item) => item.familyId === familyId && item.id === budgetId
  );

  if (!budget) {
    throw new Error("Budget not found.");
  }

  return { ...budget };
}

async function findDatabaseBudget(familyId: string, budgetId: string) {
  const budget = await prisma.budget.findFirst({
    where: {
      id: budgetId,
      familyId
    }
  });

  if (!budget) {
    throw new Error("Budget not found.");
  }

  return budget;
}

async function resolveDatabaseTargetId(input: {
  familyId: string;
  userId: string;
  targetType: BudgetTargetType;
  targetId?: string;
  category?: string;
}) {
  if (input.targetType !== "personal_category") {
    return input.targetId || null;
  }

  const categoryName = input.category?.trim();
  if (!categoryName) {
    return input.targetId || null;
  }

  const existing = await prisma.category.findFirst({
    where: {
      userId: input.userId,
      scope: "personal",
      type: "expense",
      name: categoryName
    }
  });

  if (existing) return existing.id;

  const category = await prisma.category.create({
    data: {
      userId: input.userId,
      scope: "personal",
      type: "expense",
      name: categoryName
    }
  });

  return category.id;
}

async function getCategoryNamesById(categoryIds: string[]) {
  if (categoryIds.length === 0) return new Map<string, string>();

  const categories = await prisma.category.findMany({
    where: {
      id: { in: [...new Set(categoryIds)] }
    },
    include: { parent: true }
  });

  return new Map(categories.map((category) => [category.id, formatCategoryName(category)]));
}

async function getCategoryName(categoryId: string | null) {
  if (!categoryId) return undefined;

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { parent: true }
  });

  return category ? formatCategoryName(category) : undefined;
}

function formatCategoryName(category: { name: string; parent?: { name: string } | null }) {
  return category.parent ? `${category.parent.name} > ${category.name}` : category.name;
}

async function hasBudgetOverageNotification(input: {
  familyId: string;
  userId: string;
  budgetId: string;
  spent: number;
}) {
  if (usesDatabaseRuntime("notifications")) {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: input.userId,
        familyId: input.familyId,
        type: "budget_exceeded"
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return notifications.some(
      (notification) =>
        isRecord(notification.data) &&
        notification.data.budgetId === input.budgetId &&
        notification.data.spent === input.spent
    );
  }

  return getMemoryStore().notifications.some(
    (notification) =>
      notification.type === "budget_exceeded" &&
      notification.userId === input.userId &&
      notification.familyId === input.familyId &&
      notification.data?.budgetId === input.budgetId &&
      notification.data?.spent === input.spent
  );
}

function toBudgetUsage(budget: Budget, userId: string): BudgetUsage {
  const spent = calculateSpent(budget, userId);
  const remaining = budget.amount - spent;

  return {
    budget,
    spent,
    remaining,
    exceeded: remaining < 0
  };
}

function calculateSpent(budget: Budget, userId: string) {
  const store = getMemoryStore();

  if (budget.targetType === "shared_fund" && budget.targetId) {
    return store.fundTransactions
      .filter((transaction) => transaction.familyId === budget.familyId)
      .filter((transaction) => transaction.fundId === budget.targetId)
      .filter((transaction) => transaction.type === "expense")
      .filter((transaction) => inPeriod(transaction.occurredAt, budget))
      .reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  return store.personalTransactions
    .filter((transaction) => transaction.userId === (budget.userId ?? userId))
    .filter((transaction) => transaction.type === "expense")
    .filter((transaction) => inPeriod(transaction.occurredAt, budget))
    .filter((transaction) => {
      if (budget.targetType === "personal_account" && budget.targetId) {
        return transaction.accountId === budget.targetId;
      }

      if (budget.targetType === "personal_category" && budget.category) {
        return transaction.category === budget.category;
      }

      return true;
    })
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

function budgetMatchesTransaction(
  budget: Budget,
  transaction: { accountId?: string; fundId?: string; category?: string }
) {
  if (budget.targetType === "shared_fund" && budget.targetId) {
    return budget.targetId === transaction.fundId;
  }

  if (budget.targetType === "personal_account" && budget.targetId) {
    return budget.targetId === transaction.accountId;
  }

  if (budget.targetType === "personal_category" && budget.category) {
    return budget.category === transaction.category;
  }

  return budget.targetType === "personal_category";
}

function inPeriod(occurredAt: string, budget: Budget) {
  const occurred = new Date(occurredAt).getTime();
  const start = new Date(budget.startAt).getTime();
  const end = budget.endAt ? new Date(budget.endAt).getTime() : Number.POSITIVE_INFINITY;

  return occurred >= start && occurred <= end;
}

function validateBudget(input: {
  familyId?: string;
  userId?: string;
  name: string;
  targetType: BudgetTargetType;
  targetId?: string;
  category?: string;
  amount: number;
  periodType: BudgetPeriodType;
  startAt?: string;
  endAt?: string;
}) {
  if (!input.name.trim()) throw new Error("Budget name is required.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Budget amount must be greater than 0.");
  }
  if (!["personal_category", "personal_account", "shared_fund"].includes(input.targetType)) {
    throw new Error("Invalid budget target type.");
  }
  if (!["monthly", "custom"].includes(input.periodType)) {
    throw new Error("Invalid budget period type.");
  }
}

function currentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function defaultEndAt(periodType: BudgetPeriodType, startAt: string) {
  if (periodType === "custom") return undefined;

  const start = new Date(startAt);
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  ).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
