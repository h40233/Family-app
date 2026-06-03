import { beforeEach, describe, expect, it } from "vitest";
import { resetMemoryStore } from "@/server/store";
import {
  createPersonalCategory,
  createPersonalTransaction,
  deletePersonalAccount,
  deletePersonalCategory,
  listPersonalAccounts,
  listPersonalCategories,
  listPersonalTransactions
} from "./service";

const userId = "00000000-0000-4000-8000-000000000001";

describe("personal accounting categories and account deletion", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("soft deletes personal accounts and hides their transactions", async () => {
    const [cash] = await listPersonalAccounts(userId);

    await deletePersonalAccount({ userId, accountId: cash.id });

    const accounts = await listPersonalAccounts(userId);
    const transactions = await listPersonalTransactions({ userId, accountId: cash.id });

    expect(accounts.some((account) => account.id === cash.id)).toBe(false);
    expect(transactions).toHaveLength(0);
  });

  it("supports default and custom parent-child personal categories", async () => {
    const defaultCategories = await listPersonalCategories(userId);
    const food = defaultCategories.find((category) => category.name === "食");

    expect(food?.children?.some((category) => category.name === "早餐")).toBe(true);

    const pet = await createPersonalCategory({ userId, type: "expense", name: "寵物" });
    const petFood = await createPersonalCategory({
      userId,
      type: "expense",
      parentId: pet.id,
      name: "飼料"
    });
    const [cash] = await listPersonalAccounts(userId);

    await createPersonalTransaction({
      userId,
      accountId: cash.id,
      type: "expense",
      categoryId: petFood.id,
      amount: 200
    });

    const transactions = await listPersonalTransactions({ userId, accountId: cash.id });
    expect(transactions.some((transaction) => transaction.category === "寵物 > 飼料")).toBe(true);

    await deletePersonalCategory({ userId, categoryId: pet.id });

    const categories = await listPersonalCategories(userId);
    expect(categories.some((category) => category.id === pet.id)).toBe(false);
    await expect(deletePersonalCategory({ userId, categoryId: food!.id })).rejects.toThrow("cannot be deleted");
  });
});
