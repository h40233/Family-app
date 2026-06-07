import type { FamilyRole } from "@/server/permissions";

export type FamilyPlan = "free" | "paid";

export type Family = {
  id: string;
  name: string;
  plan: FamilyPlan;
  createdAt: string;
  updatedAt: string;
};

export type FamilyMember = {
  id: string;
  familyId: string;
  userId: string;
  displayName: string;
  role: FamilyRole;
  isChildAccount: boolean;
};

export type CreateFamilyInput = {
  name: string;
};

export type JoinFamilyInput = {
  familyCode: string;
};

export type UpdateFamilyInput = {
  name?: string;
};

export type InviteFamilyMemberInput = {
  email: string;
  role: FamilyRole;
};

export type CreateChildAccountInput = {
  displayName: string;
  username: string;
  pin: string;
};

export type UpdateFamilyMemberInput = {
  role?: FamilyRole;
  displayName?: string;
};
