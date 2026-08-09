import { beforeEach, describe, expect, it } from "vitest";
import { devFixtureIds } from "@/server/dev-fixtures";
import { listNotifications } from "@/server/notifications";
import { resetMemoryStore } from "@/server/store";
import { updateBudget } from "./service";

const familyId = devFixtureIds.family;
const userId = devFixtureIds.ownerUser;

describe("budget editing notifications", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("creates a budget exceeded notification when editing a budget below existing spending", async () => {
    const usage = await updateBudget({
      familyId,
      userId,
      budgetId: devFixtureIds.foodBudget,
      amount: 50
    });

    expect(usage).toMatchObject({
      spent: 80,
      remaining: -30,
      exceeded: true
    });
    await expect(listNotifications(userId)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "budget_exceeded",
          data: expect.objectContaining({
            budgetId: devFixtureIds.foodBudget,
            spent: 80,
            remaining: -30
          })
        })
      ])
    );
  });
});
