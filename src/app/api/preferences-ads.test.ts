import { beforeEach, describe, expect, it } from "vitest";
import { resetAdminMemoryState } from "@/server/admin/state";
import { resetAuthSessionStore } from "@/server/auth";
import { getMemoryStore, resetMemoryStore } from "@/server/store";
import { PUT as adminAdsRoute } from "./v1/admin/ads/route";
import { GET as familyAdRoute } from "./v1/families/[familyId]/ads/route";
import { GET as getPreferencesRoute, PUT as updatePreferencesRoute } from "./v1/preferences/route";

const familyId = "00000000-0000-4000-8000-000000001001";
const ownerId = "00000000-0000-4000-8000-000000000001";

const ownerHeaders = {
  "content-type": "application/json",
  "x-family-os-user-id": ownerId,
  "x-family-os-user-name": "Development User",
  "x-family-os-user-email": "dev@family-os.local"
};

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost/api/v1${path}`, {
    ...init,
    headers: {
      ...ownerHeaders,
      ...init.headers
    }
  });
}

const familyContext = {
  params: Promise.resolve({ familyId })
};

describe("preferences and ads routes", () => {
  beforeEach(() => {
    resetMemoryStore();
    resetAuthSessionStore();
    resetAdminMemoryState();
  });

  it("persists theme preferences while enforcing paid theme access", async () => {
    const blockedResponse = await updatePreferencesRoute(
      request(`/preferences?familyId=${familyId}`, {
        method: "PUT",
        body: JSON.stringify({ familyId, theme: "ocean" })
      })
    );

    expect(blockedResponse.status).toBe(400);

    const defaultResponse = await getPreferencesRoute(
      request(`/preferences?familyId=${familyId}`)
    );
    await expect(defaultResponse.json()).resolves.toMatchObject({
      data: { preferences: { theme: "classic" } }
    });

    getMemoryStore().families[0].plan = "paid";

    const updatedResponse = await updatePreferencesRoute(
      request(`/preferences?familyId=${familyId}`, {
        method: "PUT",
        body: JSON.stringify({ familyId, theme: "ocean" })
      })
    );

    expect(updatedResponse.status).toBe(200);
    await expect(updatedResponse.json()).resolves.toMatchObject({
      data: { preferences: { theme: "ocean" } }
    });

    const persistedResponse = await getPreferencesRoute(
      request(`/preferences?familyId=${familyId}`)
    );
    await expect(persistedResponse.json()).resolves.toMatchObject({
      data: { preferences: { theme: "ocean" } }
    });
  });

  it("serves admin-managed ads only to free plan families", async () => {
    const enabledResponse = await adminAdsRoute(
      request("/admin/ads", {
        method: "PUT",
        body: JSON.stringify({
          placementId: "dashboard-banner",
          enabled: true,
          label: "House ad"
        })
      })
    );
    expect(enabledResponse.status).toBe(200);

    const freeResponse = await familyAdRoute(
      request(`/families/${familyId}/ads?placement=dashboard-feed`),
      familyContext
    );
    await expect(freeResponse.json()).resolves.toMatchObject({
      data: {
        ad: {
          placement: "dashboard-feed",
          label: "House ad"
        }
      }
    });

    getMemoryStore().families[0].plan = "paid";
    const paidResponse = await familyAdRoute(
      request(`/families/${familyId}/ads?placement=dashboard-feed`),
      familyContext
    );
    await expect(paidResponse.json()).resolves.toMatchObject({
      data: { ad: null }
    });

    getMemoryStore().families[0].plan = "free";
    await adminAdsRoute(
      request("/admin/ads", {
        method: "PUT",
        body: JSON.stringify({
          placementId: "dashboard-banner",
          enabled: false
        })
      })
    );

    const disabledResponse = await familyAdRoute(
      request(`/families/${familyId}/ads?placement=dashboard-feed`),
      familyContext
    );
    await expect(disabledResponse.json()).resolves.toMatchObject({
      data: { ad: null }
    });
  });
});
