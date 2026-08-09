import { beforeEach, describe, expect, it } from "vitest";
import {
  readOfflinePersonalQueue,
  removeSyncedOfflinePersonalTransactions,
  writeOfflinePersonalQueue,
  type OfflinePersonalTransaction
} from "./offline-personal-queue";

const firstTransaction: OfflinePersonalTransaction = {
  accountId: "cash",
  clientMutationId: "offline-first",
  type: "expense",
  category: "Food",
  amount: 50,
  occurredAt: "2026-05-31T00:00:00.000Z"
};

const secondTransaction: OfflinePersonalTransaction = {
  accountId: "cash",
  clientMutationId: "offline-second",
  type: "expense",
  category: "Transport",
  amount: 30,
  occurredAt: "2026-05-31T01:00:00.000Z"
};

describe("offline personal transaction queue", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("removes synced transactions by client mutation id and keeps the rest queued", () => {
    writeOfflinePersonalQueue([firstTransaction, secondTransaction]);

    const remaining = removeSyncedOfflinePersonalTransactions(["offline-first"]);

    expect(remaining).toEqual([secondTransaction]);
    expect(readOfflinePersonalQueue()).toEqual([secondTransaction]);
  });
});

function installLocalStorage() {
  const values = new Map<string, string>();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key)
      }
    }
  });
}
