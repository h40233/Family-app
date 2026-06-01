import { PermissionDeniedError } from "@/server/auth";
import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma, type Prisma } from "@/server/db/prisma";
import { getMemoryStore } from "@/server/store";
import { defaultRolePermissions } from "./roles";
import type {
  EffectivePermissions,
  FamilyRole,
  Permission,
  PermissionAction,
  PermissionCheckInput,
  PermissionCheckResult,
  ResourcePermissionOverride,
  ResourceType
} from "./types";

export async function getCurrentUserRole(
  userId: string,
  familyId: string
): Promise<FamilyRole> {
  if (usesDatabaseRuntime("permissions")) {
    const member = await prisma.familyMember.findFirst({
      where: {
        userId,
        familyId,
        deletedAt: null,
        family: { deletedAt: null }
      }
    });

    if (!member) {
      throw new PermissionDeniedError("User is not a member of this family.");
    }

    return fromPrismaRole(member.role);
  }

  const member = getMemoryStore().familyMembers.find(
    (item) => item.userId === userId && item.familyId === familyId
  );

  if (!member) {
    throw new PermissionDeniedError("User is not a member of this family.");
  }

  return member.role;
}

export async function getEffectivePermissions(
  userId: string,
  familyId: string
): Promise<EffectivePermissions> {
  if (usesDatabaseRuntime("permissions")) {
    const member = await prisma.familyMember.findFirst({
      where: {
        userId,
        familyId,
        deletedAt: null,
        family: { deletedAt: null }
      }
    });

    if (!member) {
      throw new PermissionDeniedError("User is not a member of this family.");
    }

    const role = fromPrismaRole(member.role);
    const [rolePermissionRow, resourcePermissionRows] = await Promise.all([
      prisma.familyRolePermission.findUnique({
        where: { familyId_role: { familyId, role: member.role } }
      }),
      prisma.resourcePermission.findMany({
        where: {
          familyId,
          OR: [
            { subjectType: "user", subjectId: userId },
            { subjectType: "role", subjectId: role }
          ]
        }
      })
    ]);
    const rolePermissions =
      parsePermissionList(rolePermissionRow?.permissions) ?? defaultRolePermissions[role];
    const permissions = applyMemberPermissionOverrides(
      rolePermissions,
      parseMemberPermissions(member.permissions)
    );

    return {
      role,
      permissions,
      resourceOverrides: resourcePermissionRows.map(toResourcePermissionOverride)
    };
  }

  const role = await getCurrentUserRole(userId, familyId);
  const resourceOverrides = getMemoryStore().resourcePermissionOverrides.filter(
    (override) =>
      override.familyId === familyId &&
      (override.subjectUserId === userId || override.subjectRole === role)
  );

  return {
    role,
    permissions: defaultRolePermissions[role],
    resourceOverrides
  };
}

export async function checkPermission(
  input: PermissionCheckInput
): Promise<PermissionCheckResult> {
  const effectivePermissions = await getEffectivePermissions(input.userId, input.familyId);
  const permission: Permission = `${input.resourceType}:${input.action}`;
  const baseAllowed = effectivePermissions.permissions.includes(permission);
  const overrideDecision = resolveResourceOverride(
    effectivePermissions.resourceOverrides,
    input.resourceType,
    input.resourceId,
    input.action
  );
  const allowed = overrideDecision ?? baseAllowed;

  return {
    allowed,
    reason: allowed
      ? overrideDecision === true
        ? "Allowed by resource override."
        : "Allowed by role permissions."
      : overrideDecision === false
        ? "Denied by resource override."
        : "Permission is not included in role permissions.",
    effectivePermissions
  };
}

export async function assertPermission(input: PermissionCheckInput) {
  const result = await checkPermission(input);

  if (!result.allowed) {
    throw new PermissionDeniedError(result.reason);
  }

  return result;
}

export async function listRolePermissions(
  familyId?: string
): Promise<Record<FamilyRole, Permission[]>> {
  if (usesDatabaseRuntime("permissions") && familyId) {
    const rows = await prisma.familyRolePermission.findMany({
      where: { familyId }
    });
    const roles = { ...defaultRolePermissions };

    for (const row of rows) {
      roles[fromPrismaRole(row.role)] =
        parsePermissionList(row.permissions) ?? roles[fromPrismaRole(row.role)];
    }

    return roles;
  }

  return defaultRolePermissions;
}

export async function updateRolePermissions(
  role: FamilyRole,
  permissions: Permission[],
  familyId?: string
): Promise<{ role: FamilyRole; permissions: Permission[] }> {
  if (usesDatabaseRuntime("permissions") && familyId) {
    await prisma.familyRolePermission.upsert({
      where: { familyId_role: { familyId, role: toPrismaRole(role) } },
      update: { permissions },
      create: {
        familyId,
        role: toPrismaRole(role),
        permissions
      }
    });

    return { role, permissions };
  }

  defaultRolePermissions[role] = permissions;
  return { role, permissions };
}

export async function getResourcePermissionOverrides(
  familyId: string,
  resourceType: string,
  resourceId: string
): Promise<ResourcePermissionOverride[]> {
  if (usesDatabaseRuntime("permissions")) {
    const rows = await prisma.resourcePermission.findMany({
      where: { familyId, resourceType, resourceId },
      orderBy: { createdAt: "asc" }
    });

    return rows.map(toResourcePermissionOverride);
  }

  return getMemoryStore().resourcePermissionOverrides.filter(
    (override) =>
      override.familyId === familyId &&
      override.resourceType === resourceType &&
      override.resourceId === resourceId
  );
}

export async function updateResourcePermissionOverrides(
  familyId: string,
  resourceType: string,
  resourceId: string,
  overrides: ResourcePermissionOverride[]
): Promise<{
  familyId: string;
  resourceType: string;
  resourceId: string;
  overrides: ResourcePermissionOverride[];
}> {
  if (usesDatabaseRuntime("permissions")) {
    await prisma.$transaction([
      prisma.resourcePermission.deleteMany({
        where: { familyId, resourceType, resourceId }
      }),
      ...overrides.map((override) =>
        prisma.resourcePermission.create({
          data: {
            familyId,
            resourceType,
            resourceId,
            subjectType: override.subjectUserId ? "user" : "role",
            subjectId: override.subjectUserId ?? override.subjectRole ?? "",
            permissions: {
              allow: override.allow,
              deny: override.deny
            }
          }
        })
      )
    ]);

    return { familyId, resourceType, resourceId, overrides };
  }

  const store = getMemoryStore();
  store.resourcePermissionOverrides = store.resourcePermissionOverrides.filter(
    (override) =>
      !(
        override.familyId === familyId &&
        override.resourceType === resourceType &&
        override.resourceId === resourceId
      )
  );
  store.resourcePermissionOverrides.push(...overrides);

  return { familyId, resourceType, resourceId, overrides };
}

function resolveResourceOverride(
  overrides: ResourcePermissionOverride[],
  resourceType: ResourceType,
  resourceId: string | undefined,
  action: PermissionAction
) {
  const matching = overrides.filter(
    (override) =>
      override.resourceType === resourceType &&
      (!resourceId || override.resourceId === resourceId)
  );

  if (matching.some((override) => override.deny.includes(action))) {
    return false;
  }

  if (matching.some((override) => override.allow.includes(action))) {
    return true;
  }

  return undefined;
}

function toResourcePermissionOverride(row: {
  familyId: string;
  resourceType: string;
  resourceId: string;
  subjectType: string;
  subjectId: string;
  permissions: Prisma.JsonValue;
}): ResourcePermissionOverride {
  const permissions = parseAllowDeny(row.permissions);

  return {
    familyId: row.familyId,
    resourceType: row.resourceType as ResourceType,
    resourceId: row.resourceId,
    subjectUserId: row.subjectType === "user" ? row.subjectId : undefined,
    subjectRole: row.subjectType === "role" ? (row.subjectId as FamilyRole) : undefined,
    allow: permissions.allow,
    deny: permissions.deny
  };
}

function applyMemberPermissionOverrides(
  rolePermissions: Permission[],
  override: { allow: Permission[]; deny: Permission[] }
) {
  const permissions = new Set(rolePermissions);
  for (const permission of override.allow) permissions.add(permission);
  for (const permission of override.deny) permissions.delete(permission);
  return [...permissions];
}

function parseMemberPermissions(value: Prisma.JsonValue): {
  allow: Permission[];
  deny: Permission[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { allow: [], deny: [] };
  }

  const record = value as Record<string, unknown>;
  return {
    allow: Array.isArray(record.allow) ? record.allow.filter(isPermission) : [],
    deny: Array.isArray(record.deny) ? record.deny.filter(isPermission) : []
  };
}

function parseAllowDeny(value: Prisma.JsonValue): {
  allow: PermissionAction[];
  deny: PermissionAction[];
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { allow: [], deny: [] };
  }

  const record = value as Record<string, unknown>;
  return {
    allow: Array.isArray(record.allow) ? record.allow.filter(isPermissionAction) : [],
    deny: Array.isArray(record.deny) ? record.deny.filter(isPermissionAction) : []
  };
}

function parsePermissionList(value: Prisma.JsonValue | undefined): Permission[] | undefined {
  if (!Array.isArray(value)) return undefined;

  return value.filter(isPermission);
}

function isPermission(value: unknown): value is Permission {
  if (typeof value !== "string") return false;

  const [resourceType, action] = value.split(":");
  return isResourceType(resourceType) && isPermissionAction(action);
}

function isPermissionAction(value: unknown): value is PermissionAction {
  return (
    value === "view" ||
    value === "create" ||
    value === "update" ||
    value === "delete" ||
    value === "review" ||
    value === "adjust_points" ||
    value === "manage_fund" ||
    value === "export"
  );
}

function isResourceType(value: unknown): value is ResourceType {
  return (
    value === "family" ||
    value === "member" ||
    value === "shared_fund" ||
    value === "task" ||
    value === "point_ledger" ||
    value === "wish" ||
    value === "personal_account" ||
    value === "report"
  );
}

function fromPrismaRole(role: "OWNER" | "ADMIN" | "MEMBER" | "CHILD" | "VIEWER") {
  return role.toLowerCase() as FamilyRole;
}

function toPrismaRole(role: FamilyRole) {
  return role.toUpperCase() as "OWNER" | "ADMIN" | "MEMBER" | "CHILD" | "VIEWER";
}
