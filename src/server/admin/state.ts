import type { AuthUser } from "@/server/auth";

export type MemoryAdminAuditLog = {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

export type MemoryAdPlacement = {
  id: string;
  name: string;
  location: string;
  enabled: boolean;
  label: string;
  updatedAt: string;
};

type AdminMemoryState = {
  bannedUsers: Record<string, { bannedAt: string; reason: string }>;
  auditLogs: MemoryAdminAuditLog[];
  adPlacements: MemoryAdPlacement[];
};

declare global {
  var familyOsAdminMemoryState: AdminMemoryState | undefined;
}

export function getAdminMemoryState() {
  globalThis.familyOsAdminMemoryState ??= createInitialAdminMemoryState();
  return globalThis.familyOsAdminMemoryState;
}

export function resetAdminMemoryState() {
  globalThis.familyOsAdminMemoryState = createInitialAdminMemoryState();
  return globalThis.familyOsAdminMemoryState;
}

export function isMemoryUserBanned(user: AuthUser) {
  return Boolean(getAdminMemoryState().bannedUsers[user.id]);
}

function createInitialAdminMemoryState(): AdminMemoryState {
  const updatedAt = new Date("2026-05-31T00:00:00.000Z").toISOString();

  return {
    bannedUsers: {},
    auditLogs: [],
    adPlacements: [
      {
        id: "dashboard-banner",
        name: "Dashboard banner",
        location: "dashboard",
        enabled: true,
        label: "MVP house ad",
        updatedAt
      },
      {
        id: "reports-inline",
        name: "Reports inline",
        location: "reports",
        enabled: true,
        label: "MVP sponsor slot",
        updatedAt
      },
      {
        id: "route-interstitial",
        name: "Route interstitial",
        location: "route-change",
        enabled: true,
        label: "MVP route sponsor",
        updatedAt
      }
    ]
  };
}
