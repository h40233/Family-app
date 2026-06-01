export type MoneyTransactionType = "income" | "expense";

export type PersonalAccount = {
  id: string;
  userId: string;
  name: string;
  type: "cash" | "bank" | "e_wallet" | "other";
  balance: number;
  createdAt: string;
  updatedAt: string;
};

export type PersonalTransaction = {
  id: string;
  accountId: string;
  userId: string;
  clientMutationId?: string;
  type: MoneyTransactionType;
  category?: string;
  amount: number;
  note?: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CreatePersonalAccountInput = {
  userId: string;
  name: string;
  type: PersonalAccount["type"];
};

export type CreatePersonalTransactionInput = {
  userId: string;
  accountId: string;
  clientMutationId?: string;
  type: MoneyTransactionType;
  category?: string;
  amount: number;
  note?: string;
  occurredAt?: string;
};
