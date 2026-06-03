export type OfflinePersonalTransaction = {
  accountId: string;
  clientMutationId: string;
  type: "income" | "expense";
  categoryId?: string;
  category?: string;
  amount: number;
  note?: string;
  occurredAt: string;
};

const storageKey = "family-os:offline-personal-transactions";

export function readOfflinePersonalQueue(): OfflinePersonalTransaction[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as OfflinePersonalTransaction[]) : [];
  } catch {
    return [];
  }
}

export function writeOfflinePersonalQueue(transactions: OfflinePersonalTransaction[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(transactions));
}

export function enqueueOfflinePersonalTransaction(transaction: OfflinePersonalTransaction) {
  const transactions = readOfflinePersonalQueue();
  transactions.push(transaction);
  writeOfflinePersonalQueue(transactions);
  return transactions;
}

export function clearOfflinePersonalQueue() {
  window.localStorage.removeItem(storageKey);
}

export function createClientMutationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
