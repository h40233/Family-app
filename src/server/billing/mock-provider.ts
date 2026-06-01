import { createHmac, timingSafeEqual } from "node:crypto";
import { createId, nowIso } from "@/server/store";
import type {
  BillingCheckoutInput,
  BillingProvider,
  BillingWebhookEvent
} from "./types";

export const mockBillingProvider: BillingProvider = {
  name: "mock",

  async createCheckoutSession(input: BillingCheckoutInput) {
    const id = createId("checkout");

    return {
      id,
      familyId: input.familyId,
      plan: input.plan,
      status: "completed",
      provider: "mock",
      providerSessionId: id,
      checkoutUrl: `/billing?checkout=${input.familyId}`,
      createdAt: nowIso()
    };
  },

  async validateWebhookSignature(input) {
    const secret = process.env.FAMILY_OS_BILLING_WEBHOOK_SECRET;
    if (!secret) return process.env.NODE_ENV !== "production";
    if (!input.signature) return false;

    const expected = createHmac("sha256", secret).update(input.rawBody).digest("hex");
    const actual = input.signature.replace(/^sha256=/, "");

    try {
      const expectedBuffer = Buffer.from(expected, "hex");
      const actualBuffer = Buffer.from(actual, "hex");
      return (
        expectedBuffer.length === actualBuffer.length &&
        timingSafeEqual(expectedBuffer, actualBuffer)
      );
    } catch {
      return false;
    }
  },

  async parseWebhookEvent(rawBody: string): Promise<BillingWebhookEvent> {
    const body = JSON.parse(rawBody) as Partial<BillingWebhookEvent>;

    if (
      body.type === "checkout.completed" &&
      body.familyId &&
      (body.plan === "paid" || body.plan === "free")
    ) {
      return {
        type: "checkout.completed",
        provider: "mock",
        familyId: body.familyId,
        plan: body.plan,
        providerSessionId: body.providerSessionId
      };
    }

    if (body.type === "subscription.cancelled" && body.familyId) {
      return {
        type: "subscription.cancelled",
        provider: "mock",
        familyId: body.familyId,
        plan: "free",
        providerSessionId: body.providerSessionId
      };
    }

    throw new Error("Unsupported billing webhook event.");
  }
};
