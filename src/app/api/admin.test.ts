import { beforeEach, describe, expect, it } from "vitest";
import { resetAuthSessionStore } from "@/server/auth";
import { resetAdminMemoryState } from "@/server/admin/state";
import { resetMemoryStore } from "@/server/store";
import { GET as metricsRoute } from "./v1/admin/metrics/route";
import { GET as usersRoute } from "./v1/admin/users/route";
import { POST as banRoute } from "./v1/admin/users/[userId]/ban/route";
import { POST as unbanRoute } from "./v1/admin/users/[userId]/unban/route";
import { GET as auditLogsRoute } from "./v1/admin/audit-logs/route";
import { PUT as adsRoute } from "./v1/admin/ads/route";

const ownerId = "00000000-0000-4000-8000-000000000001";
const childId = "00000000-0000-4000-8000-000000000002";

const adminHeaders = {
  "content-type": "application/json",
  "x-family-os-user-id": ownerId,
  "x-family-os-user-name": "Development User",
  "x-family-os-user-email": "dev@family-os.local"
};

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost/api/v1${path}`, {
    ...init,
    headers: {
      ...adminHeaders,
      ...init.headers
    }
  });
}

function userContext(userId = childId) {
  return {
    params: Promise.resolve({ userId })
  };
}

describe("admin routes", () => {
  beforeEach(() => {
    resetMemoryStore();
    resetAuthSessionStore();
    resetAdminMemoryState();
  });

  it("rejects non-admin users from metrics", async () => {
    const response = await metricsRoute(
      request("/admin/metrics", {
        headers: {
          "x-family-os-user-id": childId,
          "x-family-os-user-name": "Development Child",
          "x-family-os-user-email": "child@example.test",
          "x-family-os-child": "true"
        }
      })
    );

    expect(response.status).toBe(403);
  });

  it("returns basic aggregate metrics for admins", async () => {
    const response = await metricsRoute(request("/admin/metrics"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        metrics: {
          users: { total: 2, children: 1, admins: 1 },
          families: { total: 1, free: 1 },
          activity: {
            notifications: 1,
            tasks: 1,
            wishes: 1,
            personalTransactions: 1,
            fundTransactions: 1
          }
        }
      }
    });
  });

  it("bans and unbans a user while writing audit logs", async () => {
    const banResponse = await banRoute(
      request(`/admin/users/${childId}/ban`, {
        method: "POST",
        body: JSON.stringify({ reason: "smoke test" })
      }),
      userContext()
    );

    expect(banResponse.status).toBe(200);

    const usersAfterBan = await usersRoute(request("/admin/users"));
    await expect(usersAfterBan.json()).resolves.toMatchObject({
      data: {
        users: expect.arrayContaining([
          expect.objectContaining({
            id: childId,
            bannedReason: "smoke test"
          })
        ])
      }
    });

    const unbanResponse = await unbanRoute(
      request(`/admin/users/${childId}/unban`, { method: "POST" }),
      userContext()
    );

    expect(unbanResponse.status).toBe(200);

    const auditResponse = await auditLogsRoute(request("/admin/audit-logs"));
    await expect(auditResponse.json()).resolves.toMatchObject({
      data: {
        auditLogs: [
          expect.objectContaining({ action: "admin.user.unban" }),
          expect.objectContaining({ action: "admin.user.ban" })
        ]
      }
    });
  });

  it("updates ad placements and records the admin action", async () => {
    const response = await adsRoute(
      request("/admin/ads", {
        method: "PUT",
        body: JSON.stringify({
          placementId: "dashboard-banner",
          enabled: true,
          label: "House ad"
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        ad: {
          id: "dashboard-banner",
          enabled: true,
          label: "House ad"
        }
      }
    });

    const auditResponse = await auditLogsRoute(request("/admin/audit-logs"));
    await expect(auditResponse.json()).resolves.toMatchObject({
      data: {
        auditLogs: [expect.objectContaining({ action: "admin.ads.update" })]
      }
    });
  });
});
