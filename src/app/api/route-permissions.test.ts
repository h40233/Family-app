import { beforeEach, describe, expect, it } from "vitest";
import { resetMemoryStore } from "@/server/store";
import { POST as completeTaskRoute } from "./v1/families/[familyId]/tasks/[taskId]/complete/route";
import { POST as reviewTaskRoute } from "./v1/families/[familyId]/tasks/[taskId]/review/route";
import {
  DELETE as deleteMemberRoute,
  PATCH as updateMemberRoute
} from "./v1/families/[familyId]/members/[memberId]/route";
import { POST as createChildRoute } from "./v1/families/[familyId]/members/children/route";
import { POST as inviteMemberRoute } from "./v1/families/[familyId]/members/invite/route";
import {
  GET as listFundsRoute,
  POST as createFundRoute
} from "./v1/families/[familyId]/funds/route";
import {
  GET as listFundTransactionsRoute,
  POST as createFundTransactionRoute
} from "./v1/families/[familyId]/funds/[fundId]/transactions/route";
import { PATCH as updateRolePermissionsRoute } from "./v1/families/[familyId]/permissions/roles/[role]/route";
import { PATCH as updateResourcePermissionsRoute } from "./v1/families/[familyId]/resources/[resourceType]/[resourceId]/permissions/route";
import { PATCH as updateFamilyRoute } from "./v1/families/[familyId]/route";
import {
  GET as listWishesRoute,
  POST as createWishRoute
} from "./v1/families/[familyId]/wishes/route";
import { DELETE as deleteWishRoute } from "./v1/families/[familyId]/wishes/[wishId]/route";

const familyId = "00000000-0000-4000-8000-000000001001";
const childHeaders = {
  "content-type": "application/json",
  "x-family-os-user-id": "00000000-0000-4000-8000-000000000002",
  "x-family-os-user-name": "Development Child",
  "x-family-os-child": "true"
};

function childRequest(path: string, init: RequestInit = {}) {
  return new Request(`http://localhost/api/v1${path}`, {
    ...init,
    headers: {
      ...childHeaders,
      ...init.headers
    }
  });
}

function familyContext<TParams extends Record<string, string> = Record<never, never>>(
  extra = {} as TParams
) {
  return {
    params: Promise.resolve({ familyId, ...extra })
  };
}

describe("task and wish route permissions", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("returns 403 when a child reviews a task", async () => {
    const response = await reviewTaskRoute(
      childRequest(`/families/${familyId}/tasks/00000000-0000-4000-8000-000000004001/review`, {
        method: "POST",
        body: JSON.stringify({
          completionId: "completion-dev-1",
          approved: true,
          points: 1
        })
      }),
      familyContext({ taskId: "00000000-0000-4000-8000-000000004001" })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" }
    });
  });

  it("returns 403 when a child updates family settings", async () => {
    const response = await updateFamilyRoute(
      childRequest(`/families/${familyId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Child renamed family" })
      }),
      familyContext()
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" }
    });
  });

  it("returns 403 when a child updates another family member", async () => {
    const response = await updateMemberRoute(
      childRequest(`/families/${familyId}/members/00000000-0000-4000-8000-000000001101`, {
        method: "PATCH",
        body: JSON.stringify({ role: "viewer" })
      }),
      familyContext({ memberId: "00000000-0000-4000-8000-000000001101" })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" }
    });
  });

  it("returns 403 when a child removes a family member", async () => {
    const response = await deleteMemberRoute(
      childRequest(`/families/${familyId}/members/00000000-0000-4000-8000-000000001101`, {
        method: "DELETE"
      }),
      familyContext({ memberId: "00000000-0000-4000-8000-000000001101" })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" }
    });
  });

  it("returns 403 when a child invites a family member", async () => {
    const response = await inviteMemberRoute(
      childRequest(`/families/${familyId}/members/invite`, {
        method: "POST",
        body: JSON.stringify({
          email: "guest@example.test",
          role: "viewer"
        })
      }),
      familyContext()
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" }
    });
  });

  it("returns 403 when a child creates a shared fund", async () => {
    const response = await createFundRoute(
      childRequest(`/families/${familyId}/funds`, {
        method: "POST",
        body: JSON.stringify({ name: "Child fund" })
      }),
      familyContext()
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" }
    });
  });

  it("returns 403 when a child manages shared fund transactions", async () => {
    const response = await createFundTransactionRoute(
      childRequest(`/families/${familyId}/funds/00000000-0000-4000-8000-000000003001/transactions`, {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: 1
        })
      }),
      familyContext({ fundId: "00000000-0000-4000-8000-000000003001" })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" }
    });
  });

  it("returns 403 when a child views shared funds by default", async () => {
    const fundsResponse = await listFundsRoute(
      childRequest(`/families/${familyId}/funds`),
      familyContext()
    );
    const transactionsResponse = await listFundTransactionsRoute(
      childRequest(`/families/${familyId}/funds/00000000-0000-4000-8000-000000003001/transactions`),
      familyContext({ fundId: "00000000-0000-4000-8000-000000003001" })
    );

    expect(fundsResponse.status).toBe(403);
    expect(transactionsResponse.status).toBe(403);
  });

  it("returns 403 when a child creates a child account", async () => {
    const response = await createChildRoute(
      childRequest(`/families/${familyId}/members/children`, {
        method: "POST",
        body: JSON.stringify({
          username: "new-child",
          displayName: "New Child",
          pin: "1234"
        })
      }),
      familyContext()
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" }
    });
  });

  it("returns 403 when a child updates role permissions", async () => {
    const response = await updateRolePermissionsRoute(
      childRequest(`/families/${familyId}/permissions/roles/viewer`, {
        method: "PATCH",
        body: JSON.stringify({ permissions: ["family:view"] })
      }),
      {
        params: Promise.resolve({ familyId, role: "viewer" })
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" }
    });
  });

  it("returns 403 when a child updates resource permissions", async () => {
    const response = await updateResourcePermissionsRoute(
      childRequest(
        `/families/${familyId}/resources/shared_fund/00000000-0000-4000-8000-000000003001/permissions`,
        {
          method: "PATCH",
          body: JSON.stringify({ overrides: [] })
        }
      ),
      {
        params: Promise.resolve({
          familyId,
          resourceType: "shared_fund",
          resourceId: "00000000-0000-4000-8000-000000003001"
        })
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" }
    });
  });

  it("allows a child to complete a task without a permission 403", async () => {
    const response = await completeTaskRoute(
      childRequest(`/families/${familyId}/tasks/00000000-0000-4000-8000-000000004001/complete`, {
        method: "POST",
        body: JSON.stringify({})
      }),
      familyContext({ taskId: "00000000-0000-4000-8000-000000004001" })
    );

    expect(response.status).not.toBe(403);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: { taskId: "00000000-0000-4000-8000-000000004001", completedByUserId: "00000000-0000-4000-8000-000000000002" }
    });
  });

  it("returns 403 when a child deletes a wish", async () => {
    const response = await deleteWishRoute(
      childRequest(`/families/${familyId}/wishes/00000000-0000-4000-8000-000000005001`, {
        method: "DELETE"
      }),
      familyContext({ wishId: "00000000-0000-4000-8000-000000005001" })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "PERMISSION_DENIED" }
    });
  });

  it("allows a child to list and create wishes", async () => {
    const listResponse = await listWishesRoute(
      childRequest(`/families/${familyId}/wishes`),
      familyContext()
    );
    expect(listResponse.status).toBe(200);

    const createResponse = await createWishRoute(
      childRequest(`/families/${familyId}/wishes`, {
        method: "POST",
        body: JSON.stringify({
          title: "New toy",
          fulfillerId: "00000000-0000-4000-8000-000000000001"
        })
      }),
      familyContext()
    );

    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toMatchObject({
      data: {
        requesterId: "00000000-0000-4000-8000-000000000002",
        fulfillerId: "00000000-0000-4000-8000-000000000001",
        title: "New toy"
      }
    });
  });
});
