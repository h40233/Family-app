import { beforeEach, describe, expect, it } from "vitest";
import { resetMemoryStore } from "@/server/store";
import { POST as offlineSyncRoute } from "./v1/personal/offline-sync/route";

const ownerHeaders = {
  "content-type": "application/json",
  "x-family-os-user-id": "00000000-0000-4000-8000-000000000001",
  "x-family-os-user-name": "Development User"
};

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/personal/offline-sync", {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify(body)
  });
}

describe("personal offline sync API", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("returns a standard 400 response when a queued transaction cannot sync", async () => {
    const response = await offlineSyncRoute(
      request({
        transactions: [
          {
            accountId: "missing-account",
            clientMutationId: "offline-missing-account",
            type: "expense",
            amount: 50
          }
        ]
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BAD_REQUEST" }
    });
  });

  it("rejects queued transactions with non-positive amounts", async () => {
    const response = await offlineSyncRoute(
      request({
        transactions: [
          {
            accountId: "00000000-0000-4000-8000-000000002001",
            clientMutationId: "offline-zero-amount",
            type: "expense",
            amount: 0
          }
        ]
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "BAD_REQUEST" }
    });
  });
});
