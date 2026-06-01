import type { WishStatus } from "./types";

export type WishAction =
  | "accept"
  | "reject"
  | "propose_initial_price"
  | "approve_price"
  | "reject_price"
  | "propose_price_change"
  | "approve_price_change"
  | "reject_price_change"
  | "redeem"
  | "complete"
  | "requester_delete"
  | "fulfiller_delete_approved";

export const wishTransitions: Record<WishStatus, Partial<Record<WishAction, WishStatus>>> = {
  submitted: {
    accept: "pricing",
    reject: "rejected",
    requester_delete: "cancelled"
  },
  rejected: {},
  pricing: {
    propose_initial_price: "price_pending_requester",
    requester_delete: "cancelled"
  },
  price_pending_requester: {
    approve_price: "active",
    reject_price: "cancelled",
    requester_delete: "cancelled"
  },
  active: {
    propose_price_change: "price_change_pending",
    redeem: "redeemed_pending_fulfillment",
    requester_delete: "cancelled",
    fulfiller_delete_approved: "cancelled"
  },
  price_change_pending: {
    approve_price_change: "active",
    reject_price_change: "active",
    requester_delete: "cancelled",
    fulfiller_delete_approved: "cancelled"
  },
  redeemed_pending_fulfillment: {
    complete: "completed"
  },
  completed: {},
  cancelled: {}
};

export function canTransitionWish(status: WishStatus, action: WishAction) {
  return Boolean(wishTransitions[status][action]);
}

export function transitionWish(status: WishStatus, action: WishAction): WishStatus {
  const nextStatus = wishTransitions[status][action];

  if (!nextStatus) {
    throw new Error(`Illegal wish transition: ${status} -> ${action}`);
  }

  return nextStatus;
}
