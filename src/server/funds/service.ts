import { notifyBudgetOverages } from "@/server/budgets";
import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { createId, getMemoryStore, nowIso } from "@/server/store";
import { FundTransactionType as PrismaFundTransactionType } from "@prisma/client";
import type {
  CreateFundTransactionInput,
  CreateSharedFundInput,
  FundTransaction,
  SharedFund
} from "./types";

export async function listSharedFunds(familyId: string): Promise<SharedFund[]> {
  if (usesDatabaseRuntime("funds")) {
    const funds = await prisma.sharedFund.findMany({
      where: { familyId, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });

    return funds.map(toSharedFund);
  }

  return getMemoryStore().sharedFunds.filter((fund) => fund.familyId === familyId);
}

export async function createSharedFund(input: CreateSharedFundInput): Promise<SharedFund> {
  if (usesDatabaseRuntime("funds")) {
    const fund = await prisma.sharedFund.create({
      data: {
        familyId: input.familyId,
        name: input.name,
        balance: 0,
        permissions: {},
        createdBy: input.actorUserId
      }
    });

    return toSharedFund(fund);
  }

  const timestamp = nowIso();
  const fund: SharedFund = {
    id: createId("shared_fund"),
    familyId: input.familyId,
    name: input.name,
    balance: 0,
    createdBy: input.actorUserId,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  getMemoryStore().sharedFunds.push(fund);

  return fund;
}

export async function listFundTransactions(input: {
  familyId: string;
  fundId: string;
}): Promise<FundTransaction[]> {
  if (usesDatabaseRuntime("funds")) {
    const transactions = await prisma.fundTransaction.findMany({
      where: {
        familyId: input.familyId,
        fundId: input.fundId
      },
      include: { category: true },
      orderBy: { occurredAt: "desc" }
    });

    return transactions.map(toFundTransaction);
  }

  return getMemoryStore().fundTransactions
    .filter(
      (transaction) =>
        transaction.familyId === input.familyId && transaction.fundId === input.fundId
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function createFundTransaction(
  input: CreateFundTransactionInput
): Promise<FundTransaction> {
  if (usesDatabaseRuntime("funds")) {
    return createDatabaseFundTransaction(input);
  }

  const store = getMemoryStore();
  const fund = store.sharedFunds.find(
    (item) => item.familyId === input.familyId && item.id === input.fundId
  );

  if (!fund) {
    throw new Error("Shared fund not found.");
  }

  const timestamp = nowIso();
  const transaction: FundTransaction = {
    id: createId("fund_transaction"),
    familyId: input.familyId,
    fundId: input.fundId,
    actorUserId: input.actorUserId,
    type: input.type,
    category: input.category,
    amount: input.amount,
    note: input.note,
    occurredAt: input.occurredAt ?? timestamp,
    createdAt: timestamp
  };

  fund.balance += input.type === "deposit" ? input.amount : -input.amount;
  fund.updatedAt = timestamp;
  store.fundTransactions.push(transaction);

  if (transaction.type === "expense") {
    await notifyBudgetOverages({
      familyId: input.familyId,
      userId: input.actorUserId,
      fundId: input.fundId,
      category: input.category
    });
  }

  return transaction;
}

async function createDatabaseFundTransaction(
  input: CreateFundTransactionInput
): Promise<FundTransaction> {
  const categoryId = input.category
    ? await findOrCreateFundCategory({
        familyId: input.familyId,
        type: input.type,
        name: input.category
      })
    : null;

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  const transaction = await prisma.$transaction(async (tx) => {
    const fund = await tx.sharedFund.findFirst({
      where: {
        id: input.fundId,
        familyId: input.familyId,
        deletedAt: null
      }
    });

    if (!fund) {
      throw new Error("Shared fund not found.");
    }

    const created = await tx.fundTransaction.create({
      data: {
        familyId: input.familyId,
        fundId: input.fundId,
        actorUserId: input.actorUserId,
        type:
          input.type === "deposit"
            ? PrismaFundTransactionType.DEPOSIT
            : PrismaFundTransactionType.EXPENSE,
        categoryId,
        amount: input.amount,
        note: input.note ?? "",
        occurredAt
      },
      include: { category: true }
    });

    await tx.sharedFund.update({
      where: { id: input.fundId },
      data: {
        balance: {
          [input.type === "deposit" ? "increment" : "decrement"]: input.amount
        }
      }
    });

    return created;
  });

  if (transaction.type === PrismaFundTransactionType.EXPENSE) {
    await notifyBudgetOverages({
      familyId: input.familyId,
      userId: input.actorUserId,
      fundId: input.fundId,
      category: input.category
    });
  }

  return toFundTransaction(transaction);
}

async function findOrCreateFundCategory(input: {
  familyId: string;
  type: "deposit" | "expense";
  name: string;
}) {
  const existing = await prisma.category.findFirst({
    where: {
      familyId: input.familyId,
      scope: "shared_fund",
      type: input.type,
      name: input.name
    }
  });

  if (existing) return existing.id;

  const category = await prisma.category.create({
    data: {
      familyId: input.familyId,
      scope: "shared_fund",
      type: input.type,
      name: input.name
    }
  });

  return category.id;
}

function toSharedFund(fund: {
  id: string;
  familyId: string;
  name: string;
  balance: unknown;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}): SharedFund {
  return {
    id: fund.id,
    familyId: fund.familyId,
    name: fund.name,
    balance: Number(fund.balance),
    createdBy: fund.createdBy,
    createdAt: fund.createdAt.toISOString(),
    updatedAt: fund.updatedAt.toISOString()
  };
}

function toFundTransaction(transaction: {
  id: string;
  familyId: string;
  fundId: string;
  actorUserId: string;
  type: PrismaFundTransactionType;
  category?: { name: string } | null;
  amount: unknown;
  note: string;
  occurredAt: Date;
  createdAt: Date;
}): FundTransaction {
  return {
    id: transaction.id,
    familyId: transaction.familyId,
    fundId: transaction.fundId,
    actorUserId: transaction.actorUserId,
    type: transaction.type === PrismaFundTransactionType.DEPOSIT ? "deposit" : "expense",
    category: transaction.category?.name,
    amount: Number(transaction.amount),
    note: transaction.note,
    occurredAt: transaction.occurredAt.toISOString(),
    createdAt: transaction.createdAt.toISOString()
  };
}
