import { beforeEach, describe, expect, it } from "vitest";
import { devFixtureIds } from "@/server/dev-fixtures";
import { resetMemoryStore } from "@/server/store";
import {
  GET as getSharingSettingRoute,
  PATCH as updateSharingSettingRoute
} from "./v1/personal/sharing/[familyId]/route";
import { GET as listFamilyPersonalSharingRoute } from "./v1/families/[familyId]/personal-sharing/route";

const familyId = devFixtureIds.family;
const ownerHeaders = {
  "content-type": "application/json",
  "x-family-os-user-id": devFixtureIds.ownerUser,
  "x-family-os-user-name": "Development User"
};
const childHeaders = {
  "content-type": "application/json",
  "x-family-os-user-id": devFixtureIds.childUser,
  "x-family-os-user-name": "Development Child",
  "x-family-os-child": "true"
};

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost/api/v1${path}`, {
    ...init,
    headers: {
      ...init.headers
    }
  });
}

function context() {
  return {
    params: Promise.resolve({ familyId })
  };
}

describe("personal sharing API", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("updates and reads the current user's family sharing level", async () => {
    const updateResponse = await updateSharingSettingRoute(
      request(`/personal/sharing/${familyId}`, {
        method: "PATCH",
        headers: ownerHeaders,
        body: JSON.stringify({
          sharingLevel: "partial_transactions",
          config: { transactionLimit: 1, includeNotes: true }
        })
      }),
      context()
    );

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      data: {
        userId: devFixtureIds.ownerUser,
        familyId,
        sharingLevel: "partial_transactions",
        config: { transactionLimit: 1, includeNotes: true }
      }
    });

    const getResponse = await getSharingSettingRoute(
      request(`/personal/sharing/${familyId}`, {
        headers: ownerHeaders
      }),
      context()
    );

    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toMatchObject({
      data: {
        sharingLevel: "partial_transactions",
        config: { transactionLimit: 1, includeNotes: true }
      }
    });
  });

  it("returns the family-visible masked personal money summary", async () => {
    await updateSharingSettingRoute(
      request(`/personal/sharing/${familyId}`, {
        method: "PATCH",
        headers: ownerHeaders,
        body: JSON.stringify({ sharingLevel: "balance_only" })
      }),
      context()
    );

    const response = await listFamilyPersonalSharingRoute(
      request(`/families/${familyId}/personal-sharing`, {
        headers: childHeaders
      }),
      context()
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: unknown[] };
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: devFixtureIds.ownerUser,
          sharingLevel: "balance_only",
          totalBalance: 51000
        })
      ])
    );
  });
});
