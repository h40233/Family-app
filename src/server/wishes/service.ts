import { createNotification } from "@/server/notifications";
import { addPointLedgerEntry } from "@/server/points";
import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { createId, ensurePointBalance, getMemoryStore, nowIso } from "@/server/store";
import { WishStatus as PrismaWishStatus } from "@prisma/client";
import { transitionWish } from "./state-machine";
import type {
  CreateWishInput,
  ProposeWishPriceInput,
  ResolveWishPriceInput,
  Wish,
  WishMutationInput,
  WishPriceProposal,
  WishRedemption
} from "./types";

export async function listWishes(input: { familyId: string; status?: string }): Promise<Wish[]> {
  if (usesDatabaseRuntime("wishes")) {
    const wishes = await prisma.wish.findMany({
      where: {
        familyId: input.familyId,
        status: input.status ? toPrismaWishStatus(input.status) : undefined,
        deletedAt: null
      },
      orderBy: { createdAt: "desc" }
    });

    return wishes.map(toWish);
  }

  return getMemoryStore().wishes.filter((wish) => {
    if (wish.familyId !== input.familyId) return false;
    if (input.status && wish.status !== input.status) return false;
    return true;
  });
}

export async function createWish(input: CreateWishInput): Promise<Wish> {
  if (usesDatabaseRuntime("wishes")) {
    const wish = await prisma.wish.create({
      data: {
        familyId: input.familyId,
        requesterId: input.actorUserId,
        fulfillerId: input.fulfillerId,
        title: input.title,
        description: input.description ?? "",
        status: PrismaWishStatus.SUBMITTED
      }
    });

    await createNotification({
      userId: input.fulfillerId,
      familyId: input.familyId,
      type: "wish_status_changed",
      title: "New wish needs response",
      body: input.title,
      data: { wishId: wish.id }
    });

    return toWish(wish);
  }

  const createdAt = nowIso();
  const wish: Wish = {
    id: createId("wish"),
    familyId: input.familyId,
    requesterId: input.actorUserId,
    fulfillerId: input.fulfillerId,
    title: input.title,
    description: input.description,
    status: "submitted",
    createdAt,
    updatedAt: createdAt
  };

  getMemoryStore().wishes.push(wish);
  await createNotification({
    userId: input.fulfillerId,
    familyId: input.familyId,
    type: "wish_status_changed",
    title: "New wish needs response",
    body: input.title,
    data: { wishId: wish.id }
  });

  return wish;
}

export async function getWish(input: { familyId: string; wishId: string }): Promise<Wish | null> {
  if (usesDatabaseRuntime("wishes")) {
    const wish = await prisma.wish.findFirst({
      where: {
        id: input.wishId,
        familyId: input.familyId,
        deletedAt: null
      }
    });

    return wish ? toWish(wish) : null;
  }

  return (
    getMemoryStore().wishes.find(
      (wish) => wish.familyId === input.familyId && wish.id === input.wishId
    ) ?? null
  );
}

export async function acceptWish(input: WishMutationInput): Promise<Wish> {
  const wish = await requireWish(input);
  assertWishFulfiller(wish, input.actorUserId, "update");
  if (usesDatabaseRuntime("wishes")) {
    const next = transitionWish(wish.status, "accept");
    const updated = await updateDatabaseWishStatus(wish, next);
    await notifyWishRequester(updated, "Wish accepted", updated.title);
    return updated;
  }

  wish.status = transitionWish(wish.status, "accept");
  wish.updatedAt = nowIso();
  await notifyWishRequester(wish, "Wish accepted", wish.title);
  return wish;
}

export async function rejectWish(input: WishMutationInput): Promise<Wish> {
  const wish = await requireWish(input);
  assertWishFulfiller(wish, input.actorUserId, "update");
  if (usesDatabaseRuntime("wishes")) {
    const next = transitionWish(wish.status, "reject");
    const updated = await updateDatabaseWishStatus(wish, next);
    await notifyWishRequester(updated, "Wish rejected", updated.title);
    return updated;
  }

  wish.status = transitionWish(wish.status, "reject");
  wish.updatedAt = nowIso();
  await notifyWishRequester(wish, "Wish rejected", wish.title);
  return wish;
}

export async function proposeWishPrice(input: ProposeWishPriceInput): Promise<WishPriceProposal> {
  const wish = await requireWish(input);
  assertWishFulfiller(wish, input.actorUserId, "update");
  validateWishPrice(input.points);

  if (usesDatabaseRuntime("wishes")) {
    const nextStatus =
      wish.status === "pricing"
        ? transitionWish(wish.status, "propose_initial_price")
        : wish.status === "active"
          ? transitionWish(wish.status, "propose_price_change")
          : null;

    if (!nextStatus) {
      throw new Error(`Cannot propose price while wish is ${wish.status}.`);
    }

    const proposal = await prisma.$transaction(async (tx) => {
      const created = await tx.wishPriceProposal.create({
        data: {
          wishId: input.wishId,
          proposedBy: input.actorUserId,
          points: input.points,
          note: input.note ?? "",
          status: "pending"
        }
      });
      await tx.wish.update({
        where: { id: input.wishId },
        data: { status: toPrismaWishStatus(nextStatus) }
      });
      return created;
    });

    await notifyWishRequester(
      { ...wish, status: nextStatus },
      "Wish price pending approval",
      `${wish.title}: ${input.points} points`
    );

    return toWishPriceProposal(proposal, input.familyId);
  }

  const proposal: WishPriceProposal = {
    id: createId("wish_price_proposal"),
    familyId: input.familyId,
    wishId: input.wishId,
    proposedByUserId: input.actorUserId,
    points: input.points,
    note: input.note,
    status: "pending",
    createdAt: nowIso()
  };

  if (wish.status === "pricing") {
    wish.status = transitionWish(wish.status, "propose_initial_price");
  } else if (wish.status === "active") {
    wish.status = transitionWish(wish.status, "propose_price_change");
  } else {
    throw new Error(`Cannot propose price while wish is ${wish.status}.`);
  }

  wish.updatedAt = nowIso();
  getMemoryStore().wishPriceProposals.push(proposal);
  await notifyWishRequester(wish, "Wish price pending approval", `${wish.title}: ${input.points} points`);

  return proposal;
}

export async function approveWishPrice(input: ResolveWishPriceInput): Promise<Wish> {
  const wish = await requireWish(input);
  assertWishRequester(wish, input.actorUserId, "resolve");

  if (usesDatabaseRuntime("wishes")) {
    const proposal = await requireDatabasePendingProposal(input);
    const next =
      wish.status === "price_pending_requester"
        ? transitionWish(wish.status, "approve_price")
        : wish.status === "price_change_pending"
          ? transitionWish(wish.status, "approve_price_change")
          : null;

    if (!next) {
      throw new Error(`Cannot approve price while wish is ${wish.status}.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.wishPriceProposal.update({
        where: { id: input.proposalId },
        data: { status: "approved", resolvedAt: new Date() }
      });
      return tx.wish.update({
        where: { id: input.wishId },
        data: { status: toPrismaWishStatus(next), agreedPoints: proposal.points }
      });
    });
    const mapped = toWish(updated);
    await notifyWishRequester(mapped, "Wish price approved", `${mapped.title}: ${proposal.points} points`);
    return mapped;
  }

  const proposal = requirePendingProposal(input);

  if (wish.status === "price_pending_requester") {
    wish.status = transitionWish(wish.status, "approve_price");
  } else if (wish.status === "price_change_pending") {
    wish.status = transitionWish(wish.status, "approve_price_change");
  } else {
    throw new Error(`Cannot approve price while wish is ${wish.status}.`);
  }

  proposal.status = "approved";
  proposal.resolvedAt = nowIso();
  wish.agreedPoints = proposal.points;
  wish.updatedAt = nowIso();
  await notifyWishRequester(wish, "Wish price approved", `${wish.title}: ${proposal.points} points`);

  return wish;
}

export async function rejectWishPrice(input: ResolveWishPriceInput): Promise<Wish> {
  const wish = await requireWish(input);
  assertWishRequester(wish, input.actorUserId, "resolve");

  if (usesDatabaseRuntime("wishes")) {
    await requireDatabasePendingProposal(input);
    const next =
      wish.status === "price_pending_requester"
        ? transitionWish(wish.status, "reject_price")
        : wish.status === "price_change_pending"
          ? transitionWish(wish.status, "reject_price_change")
          : null;

    if (!next) {
      throw new Error(`Cannot reject price while wish is ${wish.status}.`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.wishPriceProposal.update({
        where: { id: input.proposalId },
        data: { status: "rejected", resolvedAt: new Date() }
      });
      return tx.wish.update({
        where: { id: input.wishId },
        data: { status: toPrismaWishStatus(next) }
      });
    });

    return toWish(updated);
  }

  const proposal = requirePendingProposal(input);

  if (wish.status === "price_pending_requester") {
    wish.status = transitionWish(wish.status, "reject_price");
  } else if (wish.status === "price_change_pending") {
    wish.status = transitionWish(wish.status, "reject_price_change");
  } else {
    throw new Error(`Cannot reject price while wish is ${wish.status}.`);
  }

  proposal.status = "rejected";
  proposal.resolvedAt = nowIso();
  wish.updatedAt = nowIso();

  return wish;
}

export async function redeemWish(input: WishMutationInput): Promise<WishRedemption> {
  const wish = await requireWish(input);
  assertWishRequester(wish, input.actorUserId, "redeem");

  if (usesDatabaseRuntime("wishes")) {
    return redeemDatabaseWish(input, wish);
  }

  if (wish.status !== "active") {
    throw new Error(`Cannot redeem wish while wish is ${wish.status}.`);
  }

  const pointsSpent = wish.agreedPoints ?? 0;
  const balance = ensurePointBalance(input.familyId, input.actorUserId);

  if (balance.balance < pointsSpent) {
    throw new Error("Insufficient points.");
  }

  wish.status = transitionWish(wish.status, "redeem");
  wish.updatedAt = nowIso();

  const redemption: WishRedemption = {
    id: createId("wish_redemption"),
    familyId: input.familyId,
    wishId: input.wishId,
    requesterId: input.actorUserId,
    pointsSpent,
    status: "pending_fulfillment",
    createdAt: nowIso()
  };

  getMemoryStore().wishRedemptions.push(redemption);
  await addPointLedgerEntry({
    familyId: input.familyId,
    actorUserId: input.actorUserId,
    userId: input.actorUserId,
    delta: -pointsSpent,
    reason: "wish_redemption",
    relatedEntityType: "wish_redemption",
    relatedEntityId: redemption.id,
    note: wish.title
  });
  await createNotification({
    userId: wish.fulfillerId,
    familyId: input.familyId,
    type: "wish_status_changed",
    title: "Wish redeemed and pending fulfillment",
    body: wish.title,
    data: { wishId: wish.id, redemptionId: redemption.id }
  });

  return redemption;
}

export async function completeWish(input: WishMutationInput): Promise<Wish> {
  const wish = await requireWish(input);
  assertWishFulfiller(wish, input.actorUserId, "complete");

  if (usesDatabaseRuntime("wishes")) {
    const next = transitionWish(wish.status, "complete");
    const updated = await prisma.$transaction(async (tx) => {
      await tx.wishRedemption.updateMany({
        where: { familyId: input.familyId, wishId: input.wishId, fulfilledAt: null },
        data: { fulfilledAt: new Date() }
      });
      return tx.wish.update({
        where: { id: input.wishId },
        data: { status: toPrismaWishStatus(next) }
      });
    });

    return toWish(updated);
  }

  wish.status = transitionWish(wish.status, "complete");
  wish.updatedAt = nowIso();

  const redemption = getMemoryStore().wishRedemptions.find(
    (item) => item.familyId === input.familyId && item.wishId === input.wishId
  );

  if (redemption) {
    redemption.status = "completed";
    redemption.completedAt = nowIso();
  }

  return wish;
}

export async function deleteWish(input: WishMutationInput): Promise<Wish> {
  const wish = await requireWish(input);
  if (usesDatabaseRuntime("wishes")) {
    return updateDatabaseWishStatus(wish, "cancelled");
  }

  wish.status = "cancelled";
  wish.updatedAt = nowIso();
  return wish;
}

async function notifyWishRequester(wish: Wish, title: string, body: string) {
  await createNotification({
    userId: wish.requesterId,
    familyId: wish.familyId,
    type: "wish_status_changed",
    title,
    body,
    data: { wishId: wish.id, status: wish.status }
  });
}

async function requireWish(input: WishMutationInput): Promise<Wish> {
  const wish = await getWish(input);

  if (!wish) {
    throw new Error("Wish not found.");
  }

  return wish;
}

function assertWishFulfiller(wish: Wish, actorUserId: string, action: "update" | "complete") {
  if (wish.fulfillerId === actorUserId) return;

  if (action === "complete") {
    throw new Error("Only the fulfiller can complete this wish.");
  }

  throw new Error("Only the fulfiller can update this wish.");
}

function assertWishRequester(wish: Wish, actorUserId: string, action: "resolve" | "redeem") {
  if (wish.requesterId === actorUserId) return;

  if (action === "redeem") {
    throw new Error("Only the requester can redeem this wish.");
  }

  throw new Error("Only the requester can resolve this wish.");
}

function validateWishPrice(points: number) {
  if (!Number.isFinite(points) || points <= 0) {
    throw new Error("Wish price must be greater than 0.");
  }
}

function requirePendingProposal(input: ResolveWishPriceInput): WishPriceProposal {
  const proposal = getMemoryStore().wishPriceProposals.find(
    (item) =>
      item.familyId === input.familyId &&
      item.wishId === input.wishId &&
      item.id === input.proposalId &&
      item.status === "pending"
  );

  if (!proposal) {
    throw new Error("Wish price proposal not found.");
  }

  return proposal;
}

async function redeemDatabaseWish(
  input: WishMutationInput,
  wish: Wish
): Promise<WishRedemption> {
  if (wish.status !== "active") {
    throw new Error(`Cannot redeem wish while wish is ${wish.status}.`);
  }

  const pointsSpent = wish.agreedPoints ?? 0;
  const balance = await prisma.pointBalance.findUnique({
    where: {
      familyId_userId: {
        familyId: input.familyId,
        userId: input.actorUserId
      }
    }
  });

  if (!balance || balance.balance < pointsSpent) {
    throw new Error("Insufficient points.");
  }

  const redemption = await prisma.$transaction(async (tx) => {
    await tx.wish.update({
      where: { id: input.wishId },
      data: { status: PrismaWishStatus.REDEEMED_PENDING_FULFILLMENT }
    });
    return tx.wishRedemption.create({
      data: {
        wishId: input.wishId,
        familyId: input.familyId,
        requesterId: input.actorUserId,
        pointsSpent
      }
    });
  });

  await addPointLedgerEntry({
    familyId: input.familyId,
    actorUserId: input.actorUserId,
    userId: input.actorUserId,
    delta: -pointsSpent,
    reason: "wish_redemption",
    relatedEntityType: "wish_redemption",
    relatedEntityId: redemption.id,
    note: wish.title
  });
  await createNotification({
    userId: wish.fulfillerId,
    familyId: input.familyId,
    type: "wish_status_changed",
    title: "Wish redeemed and pending fulfillment",
    body: wish.title,
    data: { wishId: wish.id, redemptionId: redemption.id }
  });

  return toWishRedemption(redemption);
}

async function updateDatabaseWishStatus(wish: Wish, status: Wish["status"]) {
  const updated = await prisma.wish.update({
    where: { id: wish.id },
    data: { status: toPrismaWishStatus(status) }
  });

  return toWish(updated);
}

async function requireDatabasePendingProposal(input: ResolveWishPriceInput) {
  const proposal = await prisma.wishPriceProposal.findFirst({
    where: {
      id: input.proposalId,
      wishId: input.wishId,
      status: "pending"
    }
  });

  if (!proposal) {
    throw new Error("Wish price proposal not found.");
  }

  return proposal;
}

function toWish(wish: {
  id: string;
  familyId: string;
  requesterId: string;
  fulfillerId: string;
  title: string;
  description: string;
  status: PrismaWishStatus;
  agreedPoints: number | null;
  createdAt: Date;
  updatedAt: Date;
}): Wish {
  return {
    id: wish.id,
    familyId: wish.familyId,
    requesterId: wish.requesterId,
    fulfillerId: wish.fulfillerId,
    title: wish.title,
    description: wish.description || undefined,
    status: fromPrismaWishStatus(wish.status),
    agreedPoints: wish.agreedPoints ?? undefined,
    createdAt: wish.createdAt.toISOString(),
    updatedAt: wish.updatedAt.toISOString()
  };
}

function toWishPriceProposal(
  proposal: {
    id: string;
    wishId: string;
    proposedBy: string;
    points: number;
    note: string;
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
  },
  familyId: string
): WishPriceProposal {
  return {
    id: proposal.id,
    familyId,
    wishId: proposal.wishId,
    proposedByUserId: proposal.proposedBy,
    points: proposal.points,
    note: proposal.note || undefined,
    status:
      proposal.status === "approved"
        ? "approved"
        : proposal.status === "rejected"
          ? "rejected"
          : "pending",
    createdAt: proposal.createdAt.toISOString(),
    resolvedAt: proposal.resolvedAt?.toISOString()
  };
}

function toWishRedemption(redemption: {
  id: string;
  familyId: string;
  wishId: string;
  requesterId: string;
  pointsSpent: number;
  redeemedAt: Date;
  fulfilledAt: Date | null;
}): WishRedemption {
  return {
    id: redemption.id,
    familyId: redemption.familyId,
    wishId: redemption.wishId,
    requesterId: redemption.requesterId,
    pointsSpent: redemption.pointsSpent,
    status: redemption.fulfilledAt ? "completed" : "pending_fulfillment",
    createdAt: redemption.redeemedAt.toISOString(),
    completedAt: redemption.fulfilledAt?.toISOString()
  };
}

function toPrismaWishStatus(status: string): PrismaWishStatus {
  switch (status) {
    case "submitted":
      return PrismaWishStatus.SUBMITTED;
    case "rejected":
      return PrismaWishStatus.REJECTED;
    case "pricing":
      return PrismaWishStatus.PRICING;
    case "price_pending_requester":
      return PrismaWishStatus.PRICE_PENDING_REQUESTER;
    case "active":
      return PrismaWishStatus.ACTIVE;
    case "price_change_pending":
      return PrismaWishStatus.PRICE_CHANGE_PENDING;
    case "redeemed_pending_fulfillment":
      return PrismaWishStatus.REDEEMED_PENDING_FULFILLMENT;
    case "completed":
      return PrismaWishStatus.COMPLETED;
    case "cancelled":
      return PrismaWishStatus.CANCELLED;
    default:
      return PrismaWishStatus.SUBMITTED;
  }
}

function fromPrismaWishStatus(status: PrismaWishStatus): Wish["status"] {
  switch (status) {
    case PrismaWishStatus.SUBMITTED:
      return "submitted";
    case PrismaWishStatus.REJECTED:
      return "rejected";
    case PrismaWishStatus.PRICING:
      return "pricing";
    case PrismaWishStatus.PRICE_PENDING_REQUESTER:
      return "price_pending_requester";
    case PrismaWishStatus.ACTIVE:
      return "active";
    case PrismaWishStatus.PRICE_CHANGE_PENDING:
      return "price_change_pending";
    case PrismaWishStatus.REDEEMED_PENDING_FULFILLMENT:
      return "redeemed_pending_fulfillment";
    case PrismaWishStatus.COMPLETED:
      return "completed";
    case PrismaWishStatus.CANCELLED:
      return "cancelled";
  }
}
