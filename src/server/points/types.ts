export type PointLedgerReason =
  | "task_auto_award"
  | "task_review_award"
  | "manual_adjustment"
  | "wish_redemption";

export type PointBalance = {
  familyId: string;
  userId: string;
  balance: number;
  updatedAt: string;
};

export type PointLedgerEntry = {
  id: string;
  familyId: string;
  userId: string;
  delta: number;
  balanceAfter: number;
  reason: PointLedgerReason;
  note?: string;
  relatedEntityType?: "task" | "task_completion" | "wish" | "wish_redemption" | "manual_adjustment";
  relatedEntityId?: string;
  actorUserId: string;
  createdAt: string;
};

export type ListPointBalancesInput = {
  familyId: string;
};

export type GetMyPointBalanceInput = {
  familyId: string;
  actorUserId: string;
};

export type ListPointLedgerInput = {
  familyId: string;
  userId?: string;
  limit?: number;
  cursor?: string;
};

export type AdjustPointsInput = {
  familyId: string;
  actorUserId: string;
  userId: string;
  delta: number;
  reason: string;
};
