import { beforeEach, describe, expect, it } from "vitest";
import { devFixtureIds } from "@/server/dev-fixtures";
import { resetMemoryStore } from "@/server/store";
import { createFundTransaction, createSharedFund, listSharedFunds } from "./service";

const familyId = devFixtureIds.family;
const actorUserId = devFixtureIds.ownerUser;

describe("shared fund validation", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("rejects empty fund names", async () => {
    await expect(
      createSharedFund({
        familyId,
        actorUserId,
        name: "   "
      })
    ).rejects.toThrow("Shared fund name is required.");
  });

  it("rejects non-positive transaction amounts", async () => {
    const [fund] = await listSharedFunds(familyId);

    await expect(
      createFundTransaction({
        familyId,
        fundId: fund.id,
        actorUserId,
        type: "expense",
        amount: 0
      })
    ).rejects.toThrow("Fund transaction amount must be greater than 0.");

    await expect(
      createFundTransaction({
        familyId,
        fundId: fund.id,
        actorUserId,
        type: "deposit",
        amount: -10
      })
    ).rejects.toThrow("Fund transaction amount must be greater than 0.");
  });
});
