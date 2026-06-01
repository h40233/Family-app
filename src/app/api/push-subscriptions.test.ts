import { beforeEach, describe, expect, it } from "vitest";
import { resetAuthSessionStore } from "@/server/auth";
import { resetMemoryStore } from "@/server/store";
import {
  GET as listSubscriptionsRoute,
  POST as createSubscriptionRoute
} from "./v1/push/subscriptions/route";
import { DELETE as deleteSubscriptionRoute } from "./v1/push/subscriptions/[subscriptionId]/route";

const ownerHeaders = {
  "content-type": "application/json",
  "x-family-os-user-id": "00000000-0000-4000-8000-000000000001",
  "x-family-os-user-name": "Development User"
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

describe("push subscription routes", () => {
  beforeEach(() => {
    resetMemoryStore();
    resetAuthSessionStore();
  });

  it("creates, lists, deduplicates, and deletes push subscriptions", async () => {
    const createResponse = await createSubscriptionRoute(
      request("/push/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          endpoint: "https://push.example.test/abc",
          keys: {
            p256dh: "public-key",
            auth: "auth-secret"
          }
        })
      })
    );

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      data: { id: string; endpoint: string };
    };

    expect(created.data.endpoint).toBe("https://push.example.test/abc");

    const duplicateResponse = await createSubscriptionRoute(
      request("/push/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          endpoint: "https://push.example.test/abc",
          keys: {
            p256dh: "rotated-public-key",
            auth: "rotated-auth-secret"
          }
        })
      })
    );
    expect(duplicateResponse.status).toBe(201);

    const listResponse = await listSubscriptionsRoute(request("/push/subscriptions"));
    const list = (await listResponse.json()) as { data: Array<{ id: string }> };
    expect(list.data).toHaveLength(1);

    const deleteResponse = await deleteSubscriptionRoute(
      request(`/push/subscriptions/${created.data.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ subscriptionId: created.data.id }) }
    );

    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toMatchObject({
      data: { id: created.data.id, deleted: true }
    });
  });
});
