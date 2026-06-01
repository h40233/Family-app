export type WishStatus =
  | "submitted"
  | "rejected"
  | "pricing"
  | "price_pending_requester"
  | "active"
  | "price_change_pending"
  | "redeemed_pending_fulfillment"
  | "completed"
  | "cancelled";

export type Wish = {
  id: string;
  familyId: string;
  requesterId: string;
  fulfillerId: string;
  title: string;
  description?: string;
  status: WishStatus;
  agreedPoints?: number;
  createdAt: string;
  updatedAt: string;
};

export type WishPriceProposal = {
  id: string;
  familyId: string;
  wishId: string;
  proposedByUserId: string;
  points: number;
  note?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
};

export type WishRedemption = {
  id: string;
  familyId: string;
  wishId: string;
  requesterId: string;
  pointsSpent: number;
  status: "pending_fulfillment" | "completed";
  createdAt: string;
  completedAt?: string;
};

export type WishMutationInput = {
  familyId: string;
  wishId: string;
  actorUserId: string;
};

export type CreateWishInput = {
  familyId: string;
  actorUserId: string;
  title: string;
  description?: string;
  fulfillerId: string;
};

export type ProposeWishPriceInput = WishMutationInput & {
  points: number;
  note?: string;
};

export type ResolveWishPriceInput = WishMutationInput & {
  proposalId: string;
};
