import { beforeEach, describe, expect, it } from "vitest";
import { createFundTransaction } from "@/server/funds";
import { createPersonalTransaction } from "@/server/money";
import { listNotifications } from "@/server/notifications";
import { resetMemoryStore } from "@/server/store";
import { createBudget, listBudgets } from "./service";

const familyId = "00000000-0000-4000-8000-000000001001";
const userId = "00000000-0000-4000-8000-000000000001";

describe("budgets service", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("tracks monthly category spending and allows negative remaining budget", async () => {
    await createBudget({
      familyId,
      userId,
      name: "Tiny Food Budget",
      targetType: "personal_category",
      category: "食 > 早餐",
      amount: 100,
      periodType: "monthly",
      startAt: "2026-05-01T00:00:00.000Z",
      endAt: "2026-05-31T23:59:59.999Z"
    });

    await createPersonalTransaction({
      userId,
      accountId: "00000000-0000-4000-8000-000000002001",
      type: "expense",
      category: "食 > 早餐",
      amount: 50,
      occurredAt: "2026-05-10T00:00:00.000Z"
    });

    const budgets = await listBudgets({ familyId, userId });
    const budget = budgets.find((item) => item.budget.name === "Tiny Food Budget");

    expect(budget).toMatchObject({
      spent: 130,
      remaining: -30,
      exceeded: true
    });
  });

  it("creates a budget exceeded notification when a personal expense crosses the limit", async () => {
    await createBudget({
      familyId,
      userId,
      name: "Breakfast Budget",
      targetType: "personal_category",
      category: "Breakfast",
      amount: 50,
      periodType: "monthly",
      startAt: "2026-05-01T00:00:00.000Z",
      endAt: "2026-05-31T23:59:59.999Z"
    });

    await createPersonalTransaction({
      userId,
      accountId: "00000000-0000-4000-8000-000000002001",
      type: "expense",
      category: "Breakfast",
      amount: 80,
      occurredAt: "2026-05-12T00:00:00.000Z"
    });

    await expect(listNotifications(userId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "budget_exceeded",
          title: "Budget exceeded"
        })
      ])
    );
  });

  it("tracks shared fund spending budgets", async () => {
    await createBudget({
      familyId,
      userId,
      name: "Fund Trip Budget",
      targetType: "shared_fund",
      targetId: "00000000-0000-4000-8000-000000003001",
      amount: 200,
      periodType: "monthly",
      startAt: "2026-05-01T00:00:00.000Z",
      endAt: "2026-05-31T23:59:59.999Z"
    });

    await createFundTransaction({
      familyId,
      fundId: "00000000-0000-4000-8000-000000003001",
      actorUserId: userId,
      type: "expense",
      amount: 250,
      occurredAt: "2026-05-20T00:00:00.000Z"
    });

    const budgets = await listBudgets({ familyId, userId });
    expect(budgets.find((item) => item.budget.name === "Fund Trip Budget")).toMatchObject({
      spent: 250,
      remaining: -50,
      exceeded: true
    });
  });
});
