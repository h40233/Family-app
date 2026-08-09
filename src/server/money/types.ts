export type MoneyTransactionType = "income" | "expense";

export type PersonalAccount = {
  id: string;
  userId: string;
  name: string;
  type: "cash" | "bank" | "e_wallet" | "other";
  balance: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type PersonalCategory = {
  id: string;
  familyId?: string;
  userId?: string;
  parentId?: string;
  parentName?: string;
  scope: string;
  type: MoneyTransactionType;
  name: string;
  icon?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  children?: PersonalCategory[];
};

export type PersonalTransaction = {
  id: string;
  accountId: string;
  userId: string;
  clientMutationId?: string;
  type: MoneyTransactionType;
  categoryId?: string;
  category?: string;
  amount: number;
  note?: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PersonalSharingLevel =
  | "none"
  | "balance_only"
  | "category_summary"
  | "partial_transactions"
  | "full";

export type PersonalSharingConfig = {
  accountIds?: string[];
  categoryIds?: string[];
  transactionLimit?: number;
  includeNotes?: boolean;
};

export type PersonalSharingSetting = {
  id: string;
  userId: string;
  familyId: string;
  sharingLevel: PersonalSharingLevel;
  config: PersonalSharingConfig;
  updatedAt: string;
};

export type SharedPersonalCategorySummary = {
  category: string;
  income: number;
  expense: number;
  transactionCount: number;
};

export type SharedPersonalTransaction = {
  id: string;
  accountId?: string;
  accountName?: string;
  type: MoneyTransactionType;
  category?: string;
  amount: number;
  note?: string;
  occurredAt: string;
};

export type SharedPersonalAccount = {
  id: string;
  name: string;
  type: PersonalAccount["type"];
  balance: number;
};

export type FamilyPersonalSharingEntry = {
  userId: string;
  displayName: string;
  sharingLevel: PersonalSharingLevel;
  totalBalance?: number;
  accounts?: SharedPersonalAccount[];
  categorySummaries?: SharedPersonalCategorySummary[];
  transactions?: SharedPersonalTransaction[];
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
  categoryId?: string;
  category?: string;
  amount: number;
  note?: string;
  occurredAt?: string;
};

export type CreatePersonalCategoryInput = {
  userId: string;
  type: MoneyTransactionType;
  parentId?: string;
  name: string;
};

export type DeletePersonalCategoryInput = {
  userId: string;
  categoryId: string;
};
