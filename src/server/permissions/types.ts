export type FamilyRole = "owner" | "admin" | "member" | "child" | "viewer";

export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "review"
  | "adjust_points"
  | "manage_fund"
  | "export";

export type ResourceType =
  | "family"
  | "member"
  | "shared_fund"
  | "task"
  | "point_ledger"
  | "wish"
  | "personal_account"
  | "report";

export type Permission = `${ResourceType}:${PermissionAction}`;

export type EffectivePermissions = {
  role: FamilyRole;
  permissions: Permission[];
  resourceOverrides: ResourcePermissionOverride[];
};

export type ResourcePermissionOverride = {
  familyId: string;
  resourceType: ResourceType;
  resourceId: string;
  subjectUserId?: string;
  subjectRole?: FamilyRole;
  allow: PermissionAction[];
  deny: PermissionAction[];
};

export type PermissionCheckInput = {
  userId: string;
  familyId: string;
  resourceType: ResourceType;
  resourceId?: string;
  action: PermissionAction;
};

export type PermissionCheckResult = {
  allowed: boolean;
  reason: string;
  effectivePermissions: EffectivePermissions;
};
