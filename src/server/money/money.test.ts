import { beforeEach, describe, expect, it } from "vitest";
import { resetMemoryStore } from "@/server/store";
import {
  createPersonalTransaction,
  listPersonalAccounts,
  listPersonalTransactions,
  syncOfflinePersonalTransactions
} from "./service";

const userId = "00000000-0000-4000-8000-000000000001";

describe("personal accounting service", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("keeps transactions scoped to their account", async () => {
    const accounts = await listPersonalAccounts(userId);
    const cash = accounts.find((account) => account.id === "00000000-0000-4000-8000-000000002001");
    const bank = accounts.find((account) => account.id === "00000000-0000-4000-8000-000000002002");

    expect(cash).toBeDefined();
    expect(bank).toBeDefined();

    const cashTransactions = await listPersonalTransactions({
      userId,
      accountId: cash!.id
    });
    const bankTransactions = await listPersonalTransactions({
      userId,
      accountId: bank!.id
    });

    expect(cashTransactions.some((transaction) => transaction.note === "Breakfast")).toBe(true);
    expect(bankTransactions.some((transaction) => transaction.note === "Breakfast")).toBe(false);
  });

  it("updates account balance when creating income and expense transactions", async () => {
    const [cash] = await listPersonalAccounts(userId);

    await createPersonalTransaction({
      userId,
      accountId: cash.id,
      type: "income",
      amount: 500,
      note: "測試?�入"
    });
    await createPersonalTransaction({
      userId,
      accountId: cash.id,
      type: "expense",
      amount: 120,
      note: "測試?�出"
    });

    const [updatedCash] = await listPersonalAccounts(userId);
    expect(updatedCash.balance).toBe(1380);
  });

  it("deduplicates offline sync by clientMutationId", async () => {
    const [cash] = await listPersonalAccounts(userId);

    await syncOfflinePersonalTransactions({
      userId,
      transactions: [
        {
          accountId: cash.id,
          clientMutationId: "offline-1",
          type: "expense",
          amount: 50
        },
        {
          accountId: cash.id,
          clientMutationId: "offline-1",
          type: "expense",
          amount: 50
        }
      ]
    });

    const transactions = await listPersonalTransactions({ userId, accountId: cash.id });
    expect(transactions.filter((transaction) => transaction.clientMutationId === "offline-1")).toHaveLength(1);
  });
});
