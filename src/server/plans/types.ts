import type { FamilyPlan } from "@/server/families";

export type PlanLimitStatus = "ok" | "warning" | "blocked";

export type PlanLimits = {
  plan: FamilyPlan;
  maxMembers: number | null;
  maxTasks: number | null;
  maxWishes: number | null;
  reportsMonths: number | null;
  canExportReports: boolean;
  canUseAdvancedReports: boolean;
  canUseMultipleThemes: boolean;
  hasAds: boolean;
};

export type PlanUsage = {
  members: number;
  tasks: number;
  wishes: number;
};

export type FamilyPlanStatus = {
  familyId: string;
  plan: FamilyPlan;
  limits: PlanLimits;
  usage: PlanUsage;
  statuses: {
    members: PlanLimitStatus;
    tasks: PlanLimitStatus;
    wishes: PlanLimitStatus;
    reportExport: PlanLimitStatus;
  };
};

export type CheckoutSession = {
  id: string;
  familyId: string;
  plan: "paid";
  status: "pending" | "completed";
  provider: string;
  providerSessionId?: string;
  checkoutUrl: string;
  createdAt: string;
};
