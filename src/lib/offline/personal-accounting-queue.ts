import Dexie, { type Table } from "dexie";

export type PendingPersonalTransactionInput = {
  accountId: string;
  type: "income" | "expense";
  categoryId: string;
  amount: string;
  note?: string;
  occurredAt: string;
};

export type PendingPersonalTransaction = PendingPersonalTransactionInput & {
  id?: number;
  clientMutationId: string;
  status: "pending" | "syncing" | "failed";
  createdAt: string;
  updatedAt: string;
  lastError?: string;
};

class FamilyOfflineDatabase extends Dexie {
  pendingPersonalTransactions!: Table<PendingPersonalTransaction, number>;

  constructor() {
    super("family-os-offline");

    this.version(1).stores({
      pendingPersonalTransactions:
        "++id, clientMutationId, accountId, status, createdAt, updatedAt"
    });
  }
}

const database = new FamilyOfflineDatabase();

function createClientMutationId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIsoString() {
  return new Date().toISOString();
}

export async function enqueuePersonalTransaction(
  input: PendingPersonalTransactionInput
) {
  const timestamp = nowIsoString();
  const pendingTransaction: PendingPersonalTransaction = {
    ...input,
    clientMutationId: createClientMutationId(),
    status: "pending",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const id = await database.pendingPersonalTransactions.add(pendingTransaction);

  return { ...pendingTransaction, id };
}

export async function listPendingPersonalTransactions() {
  return database.pendingPersonalTransactions
    .where("status")
    .anyOf(["pending", "failed"])
    .sortBy("createdAt");
}

export async function getPendingPersonalTransactionCount() {
  return database.pendingPersonalTransactions
    .where("status")
    .anyOf(["pending", "failed"])
    .count();
}

export async function markPersonalTransactionSyncing(id: number) {
  return database.pendingPersonalTransactions.update(id, {
    status: "syncing",
    updatedAt: nowIsoString()
  });
}

export async function markPersonalTransactionFailed(id: number, lastError: string) {
  return database.pendingPersonalTransactions.update(id, {
    status: "failed",
    lastError,
    updatedAt: nowIsoString()
  });
}

export async function removeSyncedPersonalTransaction(id: number) {
  return database.pendingPersonalTransactions.delete(id);
}

export async function clearPersonalAccountingQueue() {
  return database.pendingPersonalTransactions.clear();
}
