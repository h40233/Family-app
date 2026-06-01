import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { createNotification } from "@/server/notifications";
import { createId, ensurePointBalance, getMemoryStore, nowIso } from "@/server/store";
import type {
  AdjustPointsInput,
  GetMyPointBalanceInput,
  ListPointBalancesInput,
  ListPointLedgerInput,
  PointBalance,
  PointLedgerEntry,
  PointLedgerReason
} from "./types";

export async function listPointBalances(input: ListPointBalancesInput): Promise<PointBalance[]> {
  if (usesDatabaseRuntime("points")) {
    const balances = await prisma.pointBalance.findMany({
      where: { familyId: input.familyId },
      orderBy: { updatedAt: "desc" }
    });

    return balances.map(toPointBalance);
  }

  return getMemoryStore().pointBalances.filter((balance) => balance.familyId === input.familyId);
}

export async function getMyPointBalance(input: GetMyPointBalanceInput): Promise<PointBalance> {
  if (usesDatabaseRuntime("points")) {
    return toPointBalance(await ensureDatabasePointBalance(input.familyId, input.actorUserId));
  }

  return ensurePointBalance(input.familyId, input.actorUserId);
}

export async function listPointLedger(input: ListPointLedgerInput): Promise<{
  entries: PointLedgerEntry[];
  nextCursor: string | null;
}> {
  const limit = input.limit ?? 50;

  if (usesDatabaseRuntime("points")) {
    const entries = await prisma.pointLedger.findMany({
      where: {
        familyId: input.familyId,
        userId: input.userId,
        createdAt: input.cursor ? { lt: new Date(input.cursor) } : undefined
      },
      orderBy: { createdAt: "desc" },
      take: limit
    });

    return {
      entries: entries.map((entry) => toPointLedgerEntry(entry)),
      nextCursor:
        entries.length === limit ? entries.at(-1)?.createdAt.toISOString() ?? null : null
    };
  }

  const entries = getMemoryStore().pointLedger
    .filter((entry) => {
      if (entry.familyId !== input.familyId) return false;
      if (input.userId && entry.userId !== input.userId) return false;
      if (input.cursor && entry.createdAt >= input.cursor) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  return {
    entries,
    nextCursor: entries.length === limit ? entries.at(-1)?.createdAt ?? null : null
  };
}

export async function adjustPoints(input: AdjustPointsInput): Promise<PointLedgerEntry> {
  return addPointLedgerEntry({
    familyId: input.familyId,
    actorUserId: input.actorUserId,
    userId: input.userId,
    delta: input.delta,
    reason: "manual_adjustment",
    note: input.reason,
    relatedEntityType: "manual_adjustment"
  });
}

export async function addPointLedgerEntry(input: {
  familyId: string;
  actorUserId: string;
  userId: string;
  delta: number;
  reason: PointLedgerReason;
  note?: string;
  relatedEntityType?: PointLedgerEntry["relatedEntityType"];
  relatedEntityId?: string;
}): Promise<PointLedgerEntry> {
  if (usesDatabaseRuntime("points")) {
    return addDatabasePointLedgerEntry(input);
  }

  const store = getMemoryStore();
  const balance = ensurePointBalance(input.familyId, input.userId);
  balance.balance += input.delta;
  balance.updatedAt = nowIso();

  const entry: PointLedgerEntry = {
    id: createId("point_ledger"),
    familyId: input.familyId,
    userId: input.userId,
    delta: input.delta,
    balanceAfter: balance.balance,
    reason: input.reason,
    note: input.note,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    actorUserId: input.actorUserId,
    createdAt: nowIso()
  };

  store.pointLedger.push(entry);
  await notifyPointsChanged(input, entry);

  return entry;
}

async function addDatabasePointLedgerEntry(input: {
  familyId: string;
  actorUserId: string;
  userId: string;
  delta: number;
  reason: PointLedgerReason;
  note?: string;
  relatedEntityType?: PointLedgerEntry["relatedEntityType"];
  relatedEntityId?: string;
}): Promise<PointLedgerEntry> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.pointBalance.upsert({
      where: {
        familyId_userId: {
          familyId: input.familyId,
          userId: input.userId
        }
      },
      update: {
        balance: { increment: input.delta }
      },
      create: {
        familyId: input.familyId,
        userId: input.userId,
        balance: input.delta
      }
    });

    const balance = await tx.pointBalance.findUniqueOrThrow({
      where: {
        familyId_userId: {
          familyId: input.familyId,
          userId: input.userId
        }
      }
    });

    const created = await tx.pointLedger.create({
      data: {
        familyId: input.familyId,
        userId: input.userId,
        delta: input.delta,
        reason: input.reason,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: parseUuid(input.relatedEntityId),
        createdBy: input.actorUserId
      }
    });

    return { created, balanceAfter: balance.balance };
  });

  const entry = toPointLedgerEntry(result.created, result.balanceAfter);
  entry.note = input.note;

  await notifyPointsChanged(input, entry);

  return entry;
}

async function notifyPointsChanged(
  input: {
    familyId: string;
    userId: string;
    delta: number;
    reason: PointLedgerReason;
    note?: string;
  },
  entry: PointLedgerEntry
) {
  await createNotification({
    userId: input.userId,
    familyId: input.familyId,
    type: "points_changed",
    title: input.delta >= 0 ? "Points added" : "Points deducted",
    body: `${input.note ?? input.reason}: ${input.delta > 0 ? "+" : ""}${input.delta} pts`,
    data: { ledgerId: entry.id, balanceAfter: entry.balanceAfter }
  });
}

async function ensureDatabasePointBalance(familyId: string, userId: string) {
  return prisma.pointBalance.upsert({
    where: {
      familyId_userId: {
        familyId,
        userId
      }
    },
    update: {},
    create: {
      familyId,
      userId,
      balance: 0
    }
  });
}

function toPointBalance(balance: {
  familyId: string;
  userId: string;
  balance: number;
  updatedAt: Date;
}): PointBalance {
  return {
    familyId: balance.familyId,
    userId: balance.userId,
    balance: balance.balance,
    updatedAt: balance.updatedAt.toISOString()
  };
}

function toPointLedgerEntry(
  entry: {
    id: string;
    familyId: string;
    userId: string;
    delta: number;
    reason: string;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    createdBy: string;
    createdAt: Date;
  },
  balanceAfter = 0
): PointLedgerEntry {
  return {
    id: entry.id,
    familyId: entry.familyId,
    userId: entry.userId,
    delta: entry.delta,
    balanceAfter,
    reason: toPointLedgerReason(entry.reason),
    relatedEntityType: toRelatedEntityType(entry.relatedEntityType),
    relatedEntityId: entry.relatedEntityId ?? undefined,
    actorUserId: entry.createdBy,
    createdAt: entry.createdAt.toISOString()
  };
}

function toPointLedgerReason(reason: string): PointLedgerReason {
  if (
    reason === "task_auto_award" ||
    reason === "task_review_award" ||
    reason === "wish_redemption"
  ) {
    return reason;
  }

  return "manual_adjustment";
}

function toRelatedEntityType(value: string | null): PointLedgerEntry["relatedEntityType"] {
  if (
    value === "task" ||
    value === "task_completion" ||
    value === "wish" ||
    value === "wish_redemption" ||
    value === "manual_adjustment"
  ) {
    return value;
  }

  return undefined;
}

function parseUuid(value: string | undefined) {
  if (!value) return null;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : null;
}
