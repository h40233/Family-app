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

export type AdminListInput = {
  search?: string;
  limit?: number;
  cursor?: string | null;
};

export type AdminListResult<T> = {
  items: T[];
  nextCursor: string | null;
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

export async function listAdminUsers(
  input: AdminListInput = {}
): Promise<AdminListResult<AdminUserListItem>> {
  const page = normalizeAdminListInput(input);

  if (usesDatabaseRuntime("admin")) {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: page.search
          ? [
              { name: { contains: page.search, mode: "insensitive" } },
              { email: { contains: page.search, mode: "insensitive" } }
            ]
          : undefined
      },
      orderBy: { createdAt: "desc" },
      skip: page.offset,
      take: page.limit + 1,
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

    return toAdminPage(
      users.map((user) => ({
      ...user,
      bannedAt: user.bannedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString()
      })),
      page
    );
  }

  const adminState = getAdminMemoryState();

  const users = listMemoryUsers().map((user) => {
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

  return paginateAdminItems(
    users,
    page,
    (user) => [user.id, user.name, user.email ?? ""].join(" ")
  );
}

export async function listAdminFamilies(
  input: AdminListInput = {}
): Promise<AdminListResult<AdminFamilyListItem>> {
  const page = normalizeAdminListInput(input);

  if (usesDatabaseRuntime("admin")) {
    const families = await prisma.family.findMany({
      where: {
        deletedAt: null,
        OR: page.search
          ? [{ name: { contains: page.search, mode: "insensitive" } }]
          : undefined
      },
      orderBy: { createdAt: "desc" },
      skip: page.offset,
      take: page.limit + 1,
      select: {
        id: true,
        name: true,
        plan: true,
        ownerUserId: true,
        createdAt: true,
        _count: { select: { members: true } }
      }
    });

    return toAdminPage(
      families.map((family) => ({
        id: family.id,
        name: family.name,
        plan: family.plan.toLowerCase(),
        ownerUserId: family.ownerUserId,
        memberCount: family._count.members,
        createdAt: family.createdAt.toISOString()
      })),
      page
    );
  }

  const store = getMemoryStore();

  const families = store.families.map((family) => ({
    id: family.id,
    name: family.name,
    plan: family.plan,
    ownerUserId:
      store.familyMembers.find((member) => member.familyId === family.id && member.role === "owner")
        ?.userId ?? null,
    memberCount: store.familyMembers.filter((member) => member.familyId === family.id).length,
    createdAt: family.createdAt
  }));

  return paginateAdminItems(
    families,
    page,
    (family) => [family.id, family.name, family.ownerUserId ?? ""].join(" ")
  );
}

export async function setUserBan(input: {
  actorUserId: string;
  userId: string;
  banned: boolean;
  reason?: string;
}) {
  if (input.banned && !input.reason?.trim()) {
    throw new Error("Ban reason is required.");
  }

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
  if (usesDatabaseRuntime("admin")) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        location: string;
        enabled: boolean;
        label: string;
        updated_at: Date;
      }>
    >`
      SELECT id, name, location, enabled, label, updated_at
      FROM ad_placements
      ORDER BY id ASC
    `;

    return rows.map(toMemoryAdPlacement);
  }

  return getAdminMemoryState().adPlacements;
}

export async function updateAdminAdPlacement(input: {
  actorUserId: string;
  placementId: string;
  enabled: boolean;
  label?: string;
}) {
  if (usesDatabaseRuntime("admin")) {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        location: string;
        enabled: boolean;
        label: string;
        updated_at: Date;
      }>
    >`
      SELECT id, name, location, enabled, label, updated_at
      FROM ad_placements
      WHERE id = ${input.placementId}
      LIMIT 1
    `;
    const before = rows[0] ? toMemoryAdPlacement(rows[0]) : null;

    if (!before) {
      throw new Error("Ad placement was not found.");
    }

    const updatedRows = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        location: string;
        enabled: boolean;
        label: string;
        updated_at: Date;
      }>
    >`
      UPDATE ad_placements
      SET enabled = ${input.enabled}, label = ${input.label?.trim() || before.label}, updated_at = now()
      WHERE id = ${input.placementId}
      RETURNING id, name, location, enabled, label, updated_at
    `;
    const updated = toMemoryAdPlacement(updatedRows[0]);

    await writeAdminAuditLog({
      actorUserId: input.actorUserId,
      action: "admin.ads.update",
      resourceType: "ad_placement",
      resourceId: null,
      before,
      after: updated
    });

    return updated;
  }

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

function normalizeAdminListInput(input: AdminListInput) {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
  const offset = Math.max(Number(input.cursor ?? 0) || 0, 0);
  const search = input.search?.trim() || undefined;

  return { limit, offset, search };
}

function paginateAdminItems<T>(
  items: T[],
  page: ReturnType<typeof normalizeAdminListInput>,
  searchableText: (item: T) => string
): AdminListResult<T> {
  const filtered = page.search
    ? items.filter((item) =>
        searchableText(item).toLowerCase().includes(page.search!.toLowerCase())
      )
    : items;

  return toAdminPage(filtered.slice(page.offset), page);
}

function toAdminPage<T>(
  items: T[],
  page: ReturnType<typeof normalizeAdminListInput>
): AdminListResult<T> {
  const pageItems = items.slice(0, page.limit);
  const nextCursor = items.length > page.limit ? String(page.offset + page.limit) : null;

  return {
    items: pageItems,
    nextCursor
  };
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

function toMemoryAdPlacement(row: {
  id: string;
  name: string;
  location: string;
  enabled: boolean;
  label: string;
  updated_at: Date;
}): MemoryAdPlacement {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    enabled: row.enabled,
    label: row.label,
    updatedAt: row.updated_at.toISOString()
  };
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
