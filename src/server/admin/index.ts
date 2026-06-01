import { prisma } from "@/server/db/prisma";
import { devFixtureIds } from "@/server/dev-fixtures";
import { usesDatabaseRuntime } from "@/server/data-source";
import { getAuthSessionStore, requireAuth, type AuthUser } from "@/server/auth";
import { PermissionDeniedError } from "@/server/auth/errors";
import { getMemoryStore, createId, nowIso } from "@/server/store";
import { getAdminMemoryState, type MemoryAdPlacement } from "./state";

export type AdminMetrics = {
  users: { total: number; children: number; admins: number; banned: number };
  families: { total: number; paid: number; free: number };
  activity: {
    notifications: number;
    tasks: number;
    wishes: number;
    personalTransactions: number;
    fundTransactions: number;
  };
};

export type AdminUserListItem = {
  id: string;
  name: string;
  email: string | null;
  isChildAccount: boolean;
  isAdmin: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  createdAt: string | null;
};

export type AdminFamilyListItem = {
  id: string;
  name: string;
  plan: string;
  ownerUserId: string | null;
  memberCount: number;
  createdAt: string | null;
};

export async function requireAdmin(request: Request) {
  const user = await requireAuth(request);

  if (!(await isAdminUser(user))) {
    throw new PermissionDeniedError("Admin access is required.");
  }

  return user;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  if (usesDatabaseRuntime("admin")) {
    const [
      totalUsers,
      childUsers,
      adminUsers,
      bannedUsers,
      totalFamilies,
      paidFamilies,
      notifications,
      tasks,
      wishes,
      personalTransactions,
      fundTransactions
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, isChildAccount: true } }),
      prisma.user.count({ where: { deletedAt: null, isAdmin: true } }),
      prisma.user.count({ where: { deletedAt: null, bannedAt: { not: null } } }),
      prisma.family.count({ where: { deletedAt: null } }),
      prisma.family.count({ where: { deletedAt: null, plan: "PAID" } }),
      prisma.notification.count(),
      prisma.task.count({ where: { deletedAt: null } }),
      prisma.wish.count({ where: { deletedAt: null } }),
      prisma.personalTransaction.count({ where: { deletedAt: null } }),
      prisma.fundTransaction.count()
    ]);

    return {
      users: {
        total: totalUsers,
        children: childUsers,
        admins: adminUsers,
        banned: bannedUsers
      },
      families: {
        total: totalFamilies,
        paid: paidFamilies,
        free: totalFamilies - paidFamilies
      },
      activity: {
        notifications,
        tasks,
        wishes,
        personalTransactions,
        fundTransactions
      }
    };
  }

  const store = getMemoryStore();
  const users = listMemoryUsers();
  const adminState = getAdminMemoryState();

  return {
    users: {
      total: users.length,
      children: users.filter((user) => user.isChildAccount).length,
      admins: users.filter((user) => isSeededAdmin(user) || isEnvAdmin(user)).length,
      banned: Object.keys(adminState.bannedUsers).length
    },
    families: {
      total: store.families.length,
      paid: store.families.filter((family) => family.plan === "paid").length,
      free: store.families.filter((family) => family.plan === "free").length
    },
    activity: {
      notifications: store.notifications.length,
      tasks: store.tasks.length,
      wishes: store.wishes.length,
      personalTransactions: store.personalTransactions.length,
      fundTransactions: store.fundTransactions.length
    }
  };
}

export async function listAdminUsers(): Promise<AdminUserListItem[]> {
  if (usesDatabaseRuntime("admin")) {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        isChildAccount: true,
        isAdmin: true,
        bannedAt: true,
        bannedReason: true,
        createdAt: true
      }
    });

    return users.map((user) => ({
      ...user,
      bannedAt: user.bannedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString()
    }));
  }

  const adminState = getAdminMemoryState();

  return listMemoryUsers().map((user) => {
    const ban = adminState.bannedUsers[user.id];

    return {
      id: user.id,
      name: user.displayName,
      email: user.email,
      isChildAccount: user.isChildAccount,
      isAdmin: isSeededAdmin(user) || isEnvAdmin(user),
      bannedAt: ban?.bannedAt ?? null,
      bannedReason: ban?.reason ?? null,
      createdAt: null
    };
  });
}

export async function listAdminFamilies(): Promise<AdminFamilyListItem[]> {
  if (usesDatabaseRuntime("admin")) {
    const families = await prisma.family.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        plan: true,
        ownerUserId: true,
        createdAt: true,
        _count: { select: { members: true } }
      }
    });

    return families.map((family) => ({
      id: family.id,
      name: family.name,
      plan: family.plan.toLowerCase(),
      ownerUserId: family.ownerUserId,
      memberCount: family._count.members,
      createdAt: family.createdAt.toISOString()
    }));
  }

  const store = getMemoryStore();

  return store.families.map((family) => ({
    id: family.id,
    name: family.name,
    plan: family.plan,
    ownerUserId:
      store.familyMembers.find((member) => member.familyId === family.id && member.role === "owner")
        ?.userId ?? null,
    memberCount: store.familyMembers.filter((member) => member.familyId === family.id).length,
    createdAt: family.createdAt
  }));
}

export async function setUserBan(input: {
  actorUserId: string;
  userId: string;
  banned: boolean;
  reason?: string;
}) {
  if (input.actorUserId === input.userId && input.banned) {
    throw new Error("Admins cannot ban their own account.");
  }

  if (usesDatabaseRuntime("admin")) {
    const before = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, bannedAt: true, bannedReason: true }
    });

    if (!before) {
      throw new Error("User was not found.");
    }

    const user = await prisma.user.update({
      where: { id: input.userId },
      data: input.banned
        ? {
            bannedAt: new Date(),
            bannedReason: input.reason?.trim() || "Admin action"
          }
        : {
            bannedAt: null,
            bannedReason: null
          },
      select: { id: true, bannedAt: true, bannedReason: true }
    });

    await writeAdminAuditLog({
      actorUserId: input.actorUserId,
      action: input.banned ? "admin.user.ban" : "admin.user.unban",
      resourceType: "user",
      resourceId: input.userId,
      before,
      after: user
    });

    return {
      userId: user.id,
      bannedAt: user.bannedAt?.toISOString() ?? null,
      bannedReason: user.bannedReason
    };
  }

  const adminState = getAdminMemoryState();
  const before = adminState.bannedUsers[input.userId] ?? null;

  if (input.banned) {
    adminState.bannedUsers[input.userId] = {
      bannedAt: nowIso(),
      reason: input.reason?.trim() || "Admin action"
    };
  } else {
    delete adminState.bannedUsers[input.userId];
  }

  const after = adminState.bannedUsers[input.userId] ?? null;
  await writeAdminAuditLog({
    actorUserId: input.actorUserId,
    action: input.banned ? "admin.user.ban" : "admin.user.unban",
    resourceType: "user",
    resourceId: input.userId,
    before,
    after
  });

  return {
    userId: input.userId,
    bannedAt: after?.bannedAt ?? null,
    bannedReason: after?.reason ?? null
  };
}

export async function listAdminAdPlacements() {
  return getAdminMemoryState().adPlacements;
}

export async function updateAdminAdPlacement(input: {
  actorUserId: string;
  placementId: string;
  enabled: boolean;
  label?: string;
}) {
  const adminState = getAdminMemoryState();
  const placement = adminState.adPlacements.find((item) => item.id === input.placementId);

  if (!placement) {
    throw new Error("Ad placement was not found.");
  }

  const before = { ...placement };
  placement.enabled = input.enabled;
  placement.label = input.label?.trim() || placement.label;
  placement.updatedAt = nowIso();

  await writeAdminAuditLog({
    actorUserId: input.actorUserId,
    action: "admin.ads.update",
    resourceType: "ad_placement",
    resourceId: null,
    before,
    after: placement
  });

  return placement satisfies MemoryAdPlacement;
}

export async function listAdminAuditLogs() {
  if (usesDatabaseRuntime("admin")) {
    const logs = await prisma.auditLog.findMany({
      where: { resourceType: { in: ["user", "ad_placement"] } },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return logs.map((log) => ({
      id: log.id,
      actorUserId: log.actorUserId,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      before: log.before,
      after: log.after,
      createdAt: log.createdAt.toISOString()
    }));
  }

  return [...getAdminMemoryState().auditLogs].reverse().slice(0, 50);
}

async function isAdminUser(user: AuthUser) {
  if (usesDatabaseRuntime("admin")) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isAdmin: true, bannedAt: true }
    });

    return Boolean(!dbUser?.bannedAt && (dbUser?.isAdmin || isEnvAdmin(user)));
  }

  return isEnvAdmin(user) || isSeededAdmin(user);
}

async function writeAdminAuditLog(input: {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: unknown;
  after: unknown;
}) {
  if (usesDatabaseRuntime("admin")) {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        before: toJsonObject(input.before),
        after: toJsonObject(input.after)
      }
    });
    return;
  }

  getAdminMemoryState().auditLogs.push({
    id: createId("audit"),
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    before: toRecord(input.before),
    after: toRecord(input.after),
    createdAt: nowIso()
  });
}

function listMemoryUsers(): AuthUser[] {
  const store = getMemoryStore();
  const authUsers = getAuthSessionStore().registeredUsers;
  const usersById = new Map<string, AuthUser>();

  for (const user of authUsers) {
    usersById.set(user.id, user);
  }

  for (const member of store.familyMembers) {
    if (!usersById.has(member.userId)) {
      usersById.set(member.userId, {
        id: member.userId,
        displayName: member.displayName,
        email: null,
        isChildAccount: member.isChildAccount
      });
    }
  }

  return [...usersById.values()];
}

function isEnvAdmin(user: AuthUser) {
  return (
    listEnvValues("FAMILY_OS_ADMIN_USER_IDS").includes(user.id) ||
    (user.email ? listEnvValues("FAMILY_OS_ADMIN_EMAILS").includes(user.email) : false)
  );
}

function isSeededAdmin(user: AuthUser) {
  return user.id === devFixtureIds.ownerUser || user.email === "dev@family-os.local";
}

function listEnvValues(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toJsonObject(value: unknown) {
  return value === null || value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
