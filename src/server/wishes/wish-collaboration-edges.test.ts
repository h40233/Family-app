import { beforeEach, describe, expect, it } from "vitest";
import { devFixtureIds } from "@/server/dev-fixtures";
import { adjustPoints } from "@/server/points";
import { resetMemoryStore } from "@/server/store";
import {
  acceptWish,
  approveWishPrice,
  completeWish,
  createWish,
  proposeWishPrice,
  redeemWish,
  rejectWishPrice
} from "./service";

const familyId = devFixtureIds.family;
const requesterId = devFixtureIds.ownerUser;
const fulfillerId = devFixtureIds.childUser;

async function createPricingWish() {
  const wish = await createWish({
    familyId,
    actorUserId: requesterId,
    fulfillerId,
    title: "Weekend movie night"
  });

  return acceptWish({ familyId, wishId: wish.id, actorUserId: fulfillerId });
}

async function createActiveWish(points = 20) {
  const wish = await createPricingWish();
  const proposal = await proposeWishPrice({
    familyId,
    wishId: wish.id,
    actorUserId: fulfillerId,
    points
  });

  const activeWish = await approveWishPrice({
    familyId,
    wishId: wish.id,
    proposalId: proposal.id,
    actorUserId: requesterId
  });

  return { wish: activeWish, proposal };
}

describe("wish collaboration edge cases", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("allows only the fulfiller to accept, reject, and propose prices", async () => {
    const wish = await createWish({
      familyId,
      actorUserId: requesterId,
      fulfillerId,
      title: "Museum trip"
    });

    await expect(
      acceptWish({ familyId, wishId: wish.id, actorUserId: requesterId })
    ).rejects.toThrow("Only the fulfiller can update this wish.");

    const accepted = await acceptWish({ familyId, wishId: wish.id, actorUserId: fulfillerId });

    await expect(
      proposeWishPrice({
        familyId,
        wishId: accepted.id,
        actorUserId: requesterId,
        points: 12
      })
    ).rejects.toThrow("Only the fulfiller can update this wish.");
  });

  it("allows only the requester to approve or reject price proposals", async () => {
    const wish = await createPricingWish();
    const proposal = await proposeWishPrice({
      familyId,
      wishId: wish.id,
      actorUserId: fulfillerId,
      points: 15
    });

    await expect(
      approveWishPrice({
        familyId,
        wishId: wish.id,
        proposalId: proposal.id,
        actorUserId: fulfillerId
      })
    ).rejects.toThrow("Only the requester can resolve this wish.");

    await expect(
      rejectWishPrice({
        familyId,
        wishId: wish.id,
        proposalId: proposal.id,
        actorUserId: fulfillerId
      })
    ).rejects.toThrow("Only the requester can resolve this wish.");
  });

  it("allows only the requester to redeem an active wish", async () => {
    const { wish } = await createActiveWish(18);

    await adjustPoints({
      familyId,
      actorUserId: requesterId,
      userId: requesterId,
      delta: 18,
      reason: "Test points"
    });
    await adjustPoints({
      familyId,
      actorUserId: requesterId,
      userId: fulfillerId,
      delta: 18,
      reason: "Test points"
    });

    await expect(
      redeemWish({ familyId, wishId: wish.id, actorUserId: fulfillerId })
    ).rejects.toThrow("Only the requester can redeem this wish.");
  });

  it("allows only the fulfiller to complete a redeemed wish", async () => {
    const { wish } = await createActiveWish(10);
    await adjustPoints({
      familyId,
      actorUserId: requesterId,
      userId: requesterId,
      delta: 10,
      reason: "Test points"
    });

    await redeemWish({ familyId, wishId: wish.id, actorUserId: requesterId });

    await expect(
      completeWish({ familyId, wishId: wish.id, actorUserId: requesterId })
    ).rejects.toThrow("Only the fulfiller can complete this wish.");

    await expect(
      completeWish({ familyId, wishId: wish.id, actorUserId: fulfillerId })
    ).resolves.toMatchObject({ status: "completed" });
  });

  it("rejects non-positive price proposals", async () => {
    const wish = await createPricingWish();

    await expect(
      proposeWishPrice({
        familyId,
        wishId: wish.id,
        actorUserId: fulfillerId,
        points: 0
      })
    ).rejects.toThrow("Wish price must be greater than 0.");
  });
});
