import { notifyBudgetOverages } from "@/server/budgets";
import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { createId, getMemoryStore, nowIso } from "@/server/store";
import { MoneyTransactionType as PrismaMoneyTransactionType } from "@prisma/client";
import type {
  CreatePersonalAccountInput,
  CreatePersonalTransactionInput,
  PersonalAccount,
  PersonalTransaction
} from "./types";

export async function listPersonalAccounts(userId: string): Promise<PersonalAccount[]> {
  if (usesDatabaseRuntime("money")) {
    const accounts = await prisma.personalAccount.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" }
    });

    return accounts.map((account) => ({
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: parseAccountType(account.type),
      balance: Number(account.balance),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString()
    }));
  }

  return getMemoryStore().personalAccounts.filter((account) => account.userId === userId);
}

export async function createPersonalAccount(
  input: CreatePersonalAccountInput
): Promise<PersonalAccount> {
  if (usesDatabaseRuntime("money")) {
    const account = await prisma.personalAccount.create({
      data: {
        userId: input.userId,
        name: input.name,
        type: input.type,
        balance: 0
      }
    });

    return {
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: parseAccountType(account.type),
      balance: Number(account.balance),
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString()
    };
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

export async function listPersonalTransactions(input: {
  userId: string;
  accountId: string;
}): Promise<PersonalTransaction[]> {
  if (usesDatabaseRuntime("money")) {
    const transactions = await prisma.personalTransaction.findMany({
      where: {
        userId: input.userId,
        accountId: input.accountId,
        deletedAt: null
      },
      include: { category: true },
      orderBy: { occurredAt: "desc" }
    });

    return transactions.map(toPersonalTransaction);
  }

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
    (item) => item.id === input.accountId && item.userId === input.userId
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

  const timestamp = nowIso();
  const transaction: PersonalTransaction = {
    id: createId("personal_transaction"),
    accountId: input.accountId,
    userId: input.userId,
    clientMutationId: input.clientMutationId,
    type: input.type,
    category: input.category,
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
          category: input.category
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
        include: { category: true }
      })
    : null;

  if (existing) {
    return toPersonalTransaction(existing);
  }

  const categoryId = input.category
    ? await findOrCreatePersonalCategory({
        userId: input.userId,
        type: input.type,
        name: input.category
      })
    : null;

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
        categoryId,
        amount: input.amount,
        note: input.note ?? "",
        occurredAt
      },
      include: { category: true }
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

    await Promise.all(
      familyIds.map((familyId) =>
        notifyBudgetOverages({
          familyId,
          userId: input.userId,
          accountId: input.accountId,
          category: input.category
        })
      )
    );
  }

  return toPersonalTransaction(transaction);
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
      userId: input.userId,
      scope: "personal",
      type: input.type,
      name: input.name
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

function toPersonalTransaction(transaction: {
  id: string;
  accountId: string;
  userId: string;
  clientMutationId: string | null;
  type: PrismaMoneyTransactionType;
  category?: { name: string } | null;
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
    category: transaction.category?.name,
    amount: Number(transaction.amount),
    note: transaction.note,
    occurredAt: transaction.occurredAt.toISOString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString()
  };
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
