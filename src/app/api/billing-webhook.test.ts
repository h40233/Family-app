import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBillingProvider } from "@/server/billing";
import { getMemoryStore, resetMemoryStore } from "@/server/store";
import { POST as webhookRoute } from "./v1/billing/webhook/route";

const familyId = "00000000-0000-4000-8000-000000001001";

describe("billing webhook route", () => {
  beforeEach(() => {
    resetMemoryStore();
    delete process.env.FAMILY_OS_BILLING_WEBHOOK_SECRET;
  });

  afterEach(() => {
    delete process.env.FAMILY_OS_BILLING_WEBHOOK_SECRET;
    delete process.env.FAMILY_OS_BILLING_PROVIDER;
    delete process.env.FAMILY_OS_ALLOW_MOCK_BILLING;
    vi.unstubAllEnvs();
  });

  it("applies a provider checkout completion to the family plan", async () => {
    const body = JSON.stringify({
      type: "checkout.completed",
      familyId,
      plan: "paid",
      providerSessionId: "mock_session_1"
    });

    const response = await webhookRoute(
      new Request("http://localhost/api/v1/billing/webhook", {
        method: "POST",
        body
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        type: "checkout.completed",
        familyId,
        plan: "paid",
        applied: true
      }
    });
    expect(getMemoryStore().families[0].plan).toBe("paid");
  });

  it("validates configured webhook signatures", async () => {
    process.env.FAMILY_OS_BILLING_WEBHOOK_SECRET = "test-secret";
    const body = JSON.stringify({
      type: "subscription.cancelled",
      familyId,
      plan: "free"
    });
    getMemoryStore().families[0].plan = "paid";

    const badResponse = await webhookRoute(
      new Request("http://localhost/api/v1/billing/webhook", {
        method: "POST",
        body,
        headers: { "x-family-os-billing-signature": "sha256=bad" }
      })
    );
    expect(badResponse.status).toBe(400);
    expect(getMemoryStore().families[0].plan).toBe("paid");

    const signature = createHmac("sha256", "test-secret").update(body).digest("hex");
    const goodResponse = await webhookRoute(
      new Request("http://localhost/api/v1/billing/webhook", {
        method: "POST",
        body,
        headers: { "x-family-os-billing-signature": `sha256=${signature}` }
      })
    );

    expect(goodResponse.status).toBe(200);
    expect(getMemoryStore().families[0].plan).toBe("free");
  });

  it("does not allow the mock billing provider in production unless explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.FAMILY_OS_BILLING_PROVIDER;
    delete process.env.FAMILY_OS_ALLOW_MOCK_BILLING;

    expect(() => getBillingProvider()).toThrow(
      "Mock billing provider cannot be used in production."
    );

    process.env.FAMILY_OS_BILLING_PROVIDER = "mock";
    process.env.FAMILY_OS_ALLOW_MOCK_BILLING = "true";
    expect(getBillingProvider().name).toBe("mock");
  });

  it("skips duplicate provider webhook events", async () => {
    const body = JSON.stringify({
      id: "evt_checkout_paid_once",
      type: "checkout.completed",
      familyId,
      plan: "paid",
      providerSessionId: "mock_session_2"
    });

    const firstResponse = await webhookRoute(
      new Request("http://localhost/api/v1/billing/webhook", {
        method: "POST",
        body
      })
    );

    expect(firstResponse.status).toBe(200);
    expect(getMemoryStore().families[0].plan).toBe("paid");

    getMemoryStore().families[0].plan = "free";
    const duplicateResponse = await webhookRoute(
      new Request("http://localhost/api/v1/billing/webhook", {
        method: "POST",
        body
      })
    );

    expect(duplicateResponse.status).toBe(200);
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      data: {
        applied: false,
        duplicate: true,
        providerEventId: "evt_checkout_paid_once"
      }
    });
    expect(getMemoryStore().families[0].plan).toBe("free");
  });
});
