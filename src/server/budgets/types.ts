export type BudgetTargetType = "personal_category" | "personal_account" | "shared_fund";

export type BudgetPeriodType = "monthly" | "custom";

export type Budget = {
  id: string;
  familyId: string;
  userId?: string;
  targetType: BudgetTargetType;
  targetId?: string;
  name: string;
  category?: string;
  amount: number;
  periodType: BudgetPeriodType;
  startAt: string;
  endAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type BudgetUsage = {
  budget: Budget;
  spent: number;
  remaining: number;
  exceeded: boolean;
};

export type CreateBudgetInput = {
  familyId: string;
  userId: string;
  name: string;
  targetType: BudgetTargetType;
  targetId?: string;
  category?: string;
  amount: number;
  periodType: BudgetPeriodType;
  startAt?: string;
  endAt?: string;
};

export type UpdateBudgetInput = Partial<
  Pick<
    CreateBudgetInput,
    "name" | "targetType" | "targetId" | "category" | "amount" | "periodType" | "startAt" | "endAt"
  >
> & {
  familyId: string;
  budgetId: string;
  userId: string;
};
