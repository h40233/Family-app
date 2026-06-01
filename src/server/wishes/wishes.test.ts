import { beforeEach, describe, expect, it } from "vitest";
import { adjustPoints, getMyPointBalance, listPointLedger } from "@/server/points";
import { resetMemoryStore } from "@/server/store";
import {
  acceptWish,
  approveWishPrice,
  completeWish,
  createWish,
  proposeWishPrice,
  redeemWish
} from "./service";

const familyId = "00000000-0000-4000-8000-000000001001";
const actorUserId = "00000000-0000-4000-8000-000000000001";

describe("wish service", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("moves a wish through accept, price approval, redemption, and completion", async () => {
    const wish = await createWish({
      familyId,
      actorUserId,
      fulfillerId: actorUserId,
      title: "?±æœ«å¤–é?"
    });

    expect(wish.status).toBe("submitted");

    const accepted = await acceptWish({ familyId, wishId: wish.id, actorUserId });
    expect(accepted.status).toBe("pricing");

    const proposal = await proposeWishPrice({
      familyId,
      wishId: wish.id,
      actorUserId,
      points: 30
    });
    expect(proposal.status).toBe("pending");

    const active = await approveWishPrice({
      familyId,
      wishId: wish.id,
      proposalId: proposal.id,
      actorUserId
    });
    expect(active.status).toBe("active");
    expect(active.agreedPoints).toBe(30);

    await adjustPoints({
      familyId,
      actorUserId,
      userId: actorUserId,
      delta: 30,
      reason: "æ¸¬è©¦çµ¦å?"
    });

    const redemption = await redeemWish({ familyId, wishId: wish.id, actorUserId });
    expect(redemption.pointsSpent).toBe(30);

    const balance = await getMyPointBalance({ familyId, actorUserId });
    expect(balance.balance).toBe(0);
    const ledger = await listPointLedger({ familyId });
    expect(ledger.entries.some((entry) => entry.reason === "wish_redemption")).toBe(true);

    const completed = await completeWish({ familyId, wishId: wish.id, actorUserId });
    expect(completed.status).toBe("completed");
  });

  it("does not redeem when points are insufficient", async () => {
    await expect(
      redeemWish({ familyId, wishId: "00000000-0000-4000-8000-000000005001", actorUserId })
    ).rejects.toThrow("Insufficient points.");
  });
});
