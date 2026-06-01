import { beforeEach, describe, expect, it } from "vitest";
import { getMemoryStore, resetMemoryStore } from "@/server/store";
import { POST as checkoutRoute } from "./v1/families/[familyId]/billing/checkout/route";
import { GET as exportReportsRoute } from "./v1/families/[familyId]/reports/export/route";
import { GET as limitsRoute } from "./v1/families/[familyId]/plan/limits/route";

const familyId = "00000000-0000-4000-8000-000000001001";
const ownerHeaders = {
  "x-family-os-user-id": "00000000-0000-4000-8000-000000000001",
  "x-family-os-user-name": "Development User"
};

function ownerRequest(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost/api/v1${path}`, {
    ...init,
    headers: {
      ...ownerHeaders,
      ...init.headers
    }
  });
}

function familyContext() {
  return {
    params: Promise.resolve({ familyId })
  };
}

describe("report export routes", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("returns plan limits for the current family", async () => {
    const response = await limitsRoute(
      ownerRequest(`/families/${familyId}/plan/limits`),
      familyContext()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        plan: "free",
        limits: {
          canExportReports: false,
          maxMembers: 5
        },
        statuses: {
          reportExport: "blocked"
        }
      }
    });
  });

  it("blocks CSV export on the free plan", async () => {
    const response = await exportReportsRoute(
      ownerRequest(`/families/${familyId}/reports/export?format=csv`),
      familyContext()
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PLAN_LIMIT_EXCEEDED" }
    });
  });

  it("exports CSV on the paid plan", async () => {
    getMemoryStore().families[0].plan = "paid";

    const response = await exportReportsRoute(
      ownerRequest(`/families/${familyId}/reports/export?format=csv`),
      familyContext()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(await response.text()).toContain("account_balance,00000000-0000-4000-8000-000000002001");
  });

  it("upgrades through checkout and unlocks Excel export", async () => {
    const checkoutResponse = await checkoutRoute(
      ownerRequest(`/families/${familyId}/billing/checkout`, { method: "POST" }),
      familyContext()
    );

    expect(checkoutResponse.status).toBe(201);
    await expect(checkoutResponse.json()).resolves.toMatchObject({
      data: {
        familyId,
        plan: "paid",
        status: "completed",
        provider: "mock"
      }
    });

    const limitsResponse = await limitsRoute(
      ownerRequest(`/families/${familyId}/plan/limits`),
      familyContext()
    );
    await expect(limitsResponse.json()).resolves.toMatchObject({
      data: {
        plan: "paid",
        limits: { canExportReports: true }
      }
    });

    const exportResponse = await exportReportsRoute(
      ownerRequest(`/families/${familyId}/reports/export?format=xls`),
      familyContext()
    );

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("content-type")).toContain(
      "application/vnd.ms-excel"
    );
    expect(await exportResponse.text()).toContain("Excel.Sheet");
  });
});
