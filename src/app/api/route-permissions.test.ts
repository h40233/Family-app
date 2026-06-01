import { beforeEach, describe, expect, it } from "vitest";
import { resetMemoryStore } from "@/server/store";
import { POST as completeTaskRoute } from "./v1/families/[familyId]/tasks/[taskId]/complete/route";
import { POST as reviewTaskRoute } from "./v1/families/[familyId]/tasks/[taskId]/review/route";
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
