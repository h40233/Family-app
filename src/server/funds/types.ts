export type FundTransactionType = "deposit" | "expense";

export type SharedFund = {
  id: string;
  familyId: string;
  name: string;
  balance: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type FundTransaction = {
  id: string;
  familyId: string;
  fundId: string;
  actorUserId: string;
  type: FundTransactionType;
  category?: string;
  amount: number;
  note?: string;
  occurredAt: string;
  createdAt: string;
};

export type CreateSharedFundInput = {
  familyId: string;
  actorUserId: string;
  name: string;
};

export type CreateFundTransactionInput = {
  familyId: string;
  fundId: string;
  actorUserId: string;
  type: FundTransactionType;
  category?: string;
  amount: number;
  note?: string;
  occurredAt?: string;
};
