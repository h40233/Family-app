import { notifyBudgetOverages } from "@/server/budgets";
import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { createId, getMemoryStore, nowIso } from "@/server/store";
import { MoneyTransactionType as PrismaMoneyTransactionType } from "@prisma/client";
import type {
  CreatePersonalAccountInput,
  CreatePersonalCategoryInput,
  CreatePersonalTransactionInput,
  DeletePersonalCategoryInput,
  PersonalAccount,
  PersonalCategory,
  PersonalTransaction
} from "./types";

type CategoryRecord = {
  id: string;
  familyId?: string | null;
  userId?: string | null;
  parentId?: string | null;
  scope: string;
  type: string;
  name: string;
  icon?: string | null;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  parent?: { id: string; name: string } | null;
};

export async function listPersonalAccounts(userId: string): Promise<PersonalAccount[]> {
  if (usesDatabaseRuntime("money")) {
    const accounts = await prisma.personalAccount.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });

    return accounts.map(toPersonalAccount);
  }

  return getMemoryStore().personalAccounts.filter(
    (account) => account.userId === userId && !account.deletedAt
  );
}

export async function createPersonalAccount(
  input: CreatePersonalAccountInput
): Promise<PersonalAccount> {
  if (usesDatabaseRuntime("money")) {
    return toPersonalAccount(
      await prisma.personalAccount.create({
        data: {
          userId: input.userId,
          name: input.name,
          type: input.type,
          balance: 0
        }
      })
    );
  }

  const timestamp = nowIso();
  const account: PersonalAccount = {
    id: createId("personal_account"),
    userId: input.userId,
    name: input.name,
    type: input.type,
    balance: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  getMemoryStore().personalAccounts.push(account);

  return account;
}

export async function deletePersonalAccount(input: {
  userId: string;
  accountId: string;
}): Promise<{ accountId: string; deletedAt: string }> {
  if (usesDatabaseRuntime("money")) {
    const account = await prisma.personalAccount.findFirst({
      where: { id: input.accountId, userId: input.userId, deletedAt: null }
    });

    if (!account) throw new Error("Personal account not found.");

    const deletedAt = new Date();
    await prisma.personalAccount.update({
      where: { id: account.id },
      data: { deletedAt }
    });

    return { accountId: account.id, deletedAt: deletedAt.toISOString() };
  }

  const account = getMemoryStore().personalAccounts.find(
    (item) => item.id === input.accountId && item.userId === input.userId && !item.deletedAt
  );

  if (!account) throw new Error("Personal account not found.");

  account.deletedAt = nowIso();
  account.updatedAt = account.deletedAt;

  return { accountId: account.id, deletedAt: account.deletedAt };
}

export async function listPersonalCategories(userId: string): Promise<PersonalCategory[]> {
  if (usesDatabaseRuntime("money")) {
    const categories = await prisma.category.findMany({
      where: {
        scope: "personal",
        deletedAt: null,
        OR: [
          { userId },
          { userId: null, familyId: null, isSystem: true }
        ]
      },
      orderBy: [{ type: "asc" }, { createdAt: "asc" }, { name: "asc" }]
    });

    return buildCategoryTree(categories.map((category) => toPersonalCategory(category)));
  }

  const categories = getMemoryStore().categories.filter(
    (category) =>
      category.scope === "personal" &&
      !category.deletedAt &&
      (category.userId === userId || (category.isSystem && !category.userId && !category.familyId))
  );

  return buildCategoryTree(categories);
}

export async function createPersonalCategory(
  input: CreatePersonalCategoryInput
): Promise<PersonalCategory> {
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required.");

  if (usesDatabaseRuntime("money")) {
    const parent = input.parentId
      ? await getAccessibleDatabaseCategory({
          userId: input.userId,
          categoryId: input.parentId,
          type: input.type
        })
      : null;

    if (parent?.parentId) throw new Error("Only two category levels are supported.");

    const category = await prisma.category.create({
      data: {
        userId: input.userId,
        parentId: parent?.id,
        scope: "personal",
        type: input.type,
        name
      },
      include: { parent: true }
    });

    return toPersonalCategory(category);
  }

  const store = getMemoryStore();
  const parent = input.parentId
    ? getAccessibleMemoryCategory({
        userId: input.userId,
        categoryId: input.parentId,
        type: input.type
      })
    : null;

  if (parent?.parentId) throw new Error("Only two category levels are supported.");

  const timestamp = nowIso();
  const category: PersonalCategory = {
    id: createId("category"),
    userId: input.userId,
    parentId: parent?.id,
    parentName: parent?.name,
    scope: "personal",
    type: input.type,
    name,
    isSystem: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.categories.push(category);
  return category;
}

export async function deletePersonalCategory(input: DeletePersonalCategoryInput): Promise<{
  categoryId: string;
  deletedChildren: number;
}> {
  if (usesDatabaseRuntime("money")) {
    const category = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        userId: input.userId,
        isSystem: false,
        deletedAt: null
      }
    });

    if (!category) throw new Error("Category not found or cannot be deleted.");

    const deletedAt = new Date();
    const children = await prisma.category.updateMany({
      where: { parentId: category.id, userId: input.userId, isSystem: false, deletedAt: null },
      data: { deletedAt }
    });
    await prisma.category.update({
      where: { id: category.id },
      data: { deletedAt }
    });

    return { categoryId: category.id, deletedChildren: children.count };
  }

  const store = getMemoryStore();
  const category = store.categories.find(
    (item) =>
      item.id === input.categoryId &&
      item.userId === input.userId &&
      !item.isSystem &&
      !item.deletedAt
  );

  if (!category) throw new Error("Category not found or cannot be deleted.");

  const deletedAt = nowIso();
  category.deletedAt = deletedAt;
  category.updatedAt = deletedAt;
  const children = store.categories.filter(
    (item) =>
      item.parentId === category.id &&
      item.userId === input.userId &&
      !item.isSystem &&
      !item.deletedAt
  );
  for (const child of children) {
    child.deletedAt = deletedAt;
    child.updatedAt = deletedAt;
  }

  return { categoryId: category.id, deletedChildren: children.length };
}

export async function listPersonalTransactions(input: {
  userId: string;
  accountId: string;
}): Promise<PersonalTransaction[]> {
  if (usesDatabaseRuntime("money")) {
    const account = await prisma.personalAccount.findFirst({
      where: { id: input.accountId, userId: input.userId, deletedAt: null },
      select: { id: true }
    });

    if (!account) return [];

    const transactions = await prisma.personalTransaction.findMany({
      where: {
        userId: input.userId,
        accountId: input.accountId,
        deletedAt: null
      },
      include: { category: { include: { parent: true } } },
      orderBy: { occurredAt: "desc" }
    });

    return transactions.map(toPersonalTransaction);
  }

  const account = getMemoryStore().personalAccounts.find(
    (item) => item.id === input.accountId && item.userId === input.userId && !item.deletedAt
  );
  if (!account) return [];

  return getMemoryStore().personalTransactions
    .filter(
      (transaction) =>
        transaction.userId === input.userId && transaction.accountId === input.accountId
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function createPersonalTransaction(
  input: CreatePersonalTransactionInput
): Promise<PersonalTransaction> {
  if (usesDatabaseRuntime("money")) {
    return createDatabasePersonalTransaction(input);
  }

  const store = getMemoryStore();
  const account = store.personalAccounts.find(
    (item) => item.id === input.accountId && item.userId === input.userId && !item.deletedAt
  );

  if (!account) {
    throw new Error("Personal account not found.");
  }

  if (input.clientMutationId) {
    const existing = store.personalTransactions.find(
      (transaction) =>
        transaction.userId === input.userId &&
        transaction.clientMutationId === input.clientMutationId
    );

    if (existing) {
      return existing;
    }
  }

  const category = input.categoryId
    ? getAccessibleMemoryCategory({
        userId: input.userId,
        categoryId: input.categoryId,
        type: input.type
      })
    : null;
  const categoryName = category ? formatCategoryName(category) : input.category;
  const timestamp = nowIso();
  const transaction: PersonalTransaction = {
    id: createId("personal_transaction"),
    accountId: input.accountId,
    userId: input.userId,
    clientMutationId: input.clientMutationId,
    type: input.type,
    categoryId: category?.id,
    category: categoryName,
    amount: input.amount,
    note: input.note,
    occurredAt: input.occurredAt ?? timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  account.balance += input.type === "income" ? input.amount : -input.amount;
  account.updatedAt = timestamp;
  store.personalTransactions.push(transaction);

  if (transaction.type === "expense") {
    const memberships = store.familyMembers.filter(
      (member) => member.userId === input.userId
    );

    await Promise.all(
      memberships.map((member) =>
        notifyBudgetOverages({
          familyId: member.familyId,
          userId: input.userId,
          accountId: input.accountId,
          category: categoryName
        })
      )
    );
  }

  return transaction;
}

export async function syncOfflinePersonalTransactions(input: {
  userId: string;
  transactions: Array<Omit<CreatePersonalTransactionInput, "userId">>;
}) {
  const transactions = [];

  for (const transaction of input.transactions) {
    transactions.push(
      await createPersonalTransaction({
        ...transaction,
        userId: input.userId
      })
    );
  }

  return { transactions };
}

async function createDatabasePersonalTransaction(
  input: CreatePersonalTransactionInput
): Promise<PersonalTransaction> {
  const clientMutationId = parseUuid(input.clientMutationId);

  const existing = clientMutationId
    ? await prisma.personalTransaction.findFirst({
        where: {
          userId: input.userId,
          clientMutationId
        },
        include: { category: { include: { parent: true } } }
      })
    : null;

  if (existing) {
    return toPersonalTransaction(existing);
  }

  const resolvedCategory = await resolveDatabasePersonalCategory(input);
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  const transaction = await prisma.$transaction(async (tx) => {
    const account = await tx.personalAccount.findFirst({
      where: {
        id: input.accountId,
        userId: input.userId,
        deletedAt: null
      }
    });

    if (!account) {
      throw new Error("Personal account not found.");
    }

    const created = await tx.personalTransaction.create({
      data: {
        accountId: input.accountId,
        userId: input.userId,
        clientMutationId,
        type:
          input.type === "income"
            ? PrismaMoneyTransactionType.INCOME
            : PrismaMoneyTransactionType.EXPENSE,
        categoryId: resolvedCategory?.id,
        amount: input.amount,
        note: input.note ?? "",
        occurredAt
      },
      include: { category: { include: { parent: true } } }
    });

    await tx.personalAccount.update({
      where: { id: input.accountId },
      data: {
        balance: {
          [input.type === "income" ? "increment" : "decrement"]: input.amount
        }
      }
    });

    return created;
  });

  if (transaction.type === PrismaMoneyTransactionType.EXPENSE) {
    const familyIds = await listFamilyIdsForUser(input.userId);
    const categoryName = transaction.category ? formatCategoryName(transaction.category) : input.category;

    await Promise.all(
      familyIds.map((familyId) =>
        notifyBudgetOverages({
          familyId,
          userId: input.userId,
          accountId: input.accountId,
          category: categoryName
        })
      )
    );
  }

  return toPersonalTransaction(transaction);
}

async function resolveDatabasePersonalCategory(input: CreatePersonalTransactionInput) {
  if (input.categoryId) {
    return getAccessibleDatabaseCategory({
      userId: input.userId,
      categoryId: input.categoryId,
      type: input.type
    });
  }

  if (!input.category?.trim()) return null;

  return {
    id: await findOrCreatePersonalCategory({
      userId: input.userId,
      type: input.type,
      name: input.category.trim()
    })
  };
}

async function getAccessibleDatabaseCategory(input: {
  userId: string;
  categoryId: string;
  type: "income" | "expense";
}) {
  const category = await prisma.category.findFirst({
    where: {
      id: input.categoryId,
      scope: "personal",
      type: input.type,
      deletedAt: null,
      OR: [
        { userId: input.userId },
        { userId: null, familyId: null, isSystem: true }
      ]
    },
    include: { parent: true }
  });

  if (!category) throw new Error("Category not found.");

  return category;
}

function getAccessibleMemoryCategory(input: {
  userId: string;
  categoryId: string;
  type: "income" | "expense";
}) {
  const category = getMemoryStore().categories.find(
    (item) =>
      item.id === input.categoryId &&
      item.scope === "personal" &&
      item.type === input.type &&
      !item.deletedAt &&
      (item.userId === input.userId || (item.isSystem && !item.userId && !item.familyId))
  );

  if (!category) throw new Error("Category not found.");

  return category;
}

async function listFamilyIdsForUser(userId: string) {
  if (usesDatabaseRuntime("money")) {
    const memberships = await prisma.familyMember.findMany({
      where: {
        userId,
        deletedAt: null
      },
      select: { familyId: true }
    });

    return memberships.map((membership) => membership.familyId);
  }

  return getMemoryStore().familyMembers
    .filter((member) => member.userId === userId)
    .map((member) => member.familyId);
}

async function findOrCreatePersonalCategory(input: {
  userId: string;
  type: "income" | "expense";
  name: string;
}) {
  const existing = await prisma.category.findFirst({
    where: {
      scope: "personal",
      type: input.type,
      name: input.name,
      deletedAt: null,
      OR: [
        { userId: input.userId },
        { userId: null, familyId: null, isSystem: true }
      ]
    }
  });

  if (existing) return existing.id;

  const category = await prisma.category.create({
    data: {
      userId: input.userId,
      scope: "personal",
      type: input.type,
      name: input.name
    }
  });

  return category.id;
}

function toPersonalAccount(account: {
  id: string;
  userId: string;
  name: string;
  type: string;
  balance: unknown;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}): PersonalAccount {
  return {
    id: account.id,
    userId: account.userId,
    name: account.name,
    type: parseAccountType(account.type),
    balance: Number(account.balance),
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    deletedAt: account.deletedAt?.toISOString()
  };
}

function toPersonalTransaction(transaction: {
  id: string;
  accountId: string;
  userId: string;
  clientMutationId: string | null;
  type: PrismaMoneyTransactionType;
  category?: (CategoryRecord & { id: string }) | null;
  amount: unknown;
  note: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): PersonalTransaction {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    userId: transaction.userId,
    clientMutationId: transaction.clientMutationId ?? undefined,
    type: transaction.type === PrismaMoneyTransactionType.INCOME ? "income" : "expense",
    categoryId: transaction.category?.id,
    category: transaction.category ? formatCategoryName(transaction.category) : undefined,
    amount: Number(transaction.amount),
    note: transaction.note,
    occurredAt: transaction.occurredAt.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString()
  };
}

function toPersonalCategory(category: CategoryRecord): PersonalCategory {
  return {
    id: category.id,
    familyId: category.familyId ?? undefined,
    userId: category.userId ?? undefined,
    parentId: category.parentId ?? undefined,
    parentName: category.parent?.name,
    scope: category.scope,
    type: category.type === "income" ? "income" : "expense",
    name: category.name,
    icon: category.icon ?? undefined,
    isSystem: category.isSystem,
    createdAt: toIso(category.createdAt),
    updatedAt: toIso(category.updatedAt)
  };
}

function buildCategoryTree(categories: PersonalCategory[]) {
  const byId = new Map(categories.map((category) => [category.id, { ...category, children: [] as PersonalCategory[] }]));

  for (const category of byId.values()) {
    if (!category.parentId) continue;
    const parent = byId.get(category.parentId);
    if (!parent) continue;
    category.parentName = parent.name;
    parent.children = [...(parent.children ?? []), category];
  }

  return [...byId.values()].filter((category) => !category.parentId || !byId.has(category.parentId));
}

function formatCategoryName(category: {
  name: string;
  parentId?: string | null;
  parentName?: string;
  parent?: { name: string } | null;
}) {
  const parentName = category.parentName ?? category.parent?.name;
  return parentName ? `${parentName} > ${category.name}` : category.name;
}

function parseAccountType(value: string): PersonalAccount["type"] {
  if (value === "cash" || value === "bank" || value === "e_wallet" || value === "other") {
    return value;
  }

  return "other";
}

function parseUuid(value: string | undefined) {
  if (!value) return null;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : null;
}

function toIso(value: Date | string) {
  return typeof value === "string" ? value : value.toISOString();
}
