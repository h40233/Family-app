import type { FamilyPlan } from "@/server/families";
import type { CheckoutSession } from "@/server/plans";

export type BillingProviderName = "mock";

export type BillingCheckoutInput = {
  familyId: string;
  userId: string;
  plan: "paid";
};

export type BillingWebhookEvent =
  | {
      type: "checkout.completed";
      provider: string;
      providerEventId?: string;
      familyId: string;
      plan: FamilyPlan;
      providerSessionId?: string;
    }
  | {
      type: "subscription.cancelled";
      provider: string;
      providerEventId?: string;
      familyId: string;
      plan: "free";
      providerSessionId?: string;
    };

export type BillingWebhookEventRecord = {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: BillingWebhookEvent["type"];
  familyId: string;
  plan: FamilyPlan;
  providerSessionId?: string;
  rawBody: string;
  processedAt: string;
};

export type BillingProvider = {
  name: BillingProviderName;
  createCheckoutSession(input: BillingCheckoutInput): Promise<CheckoutSession>;
  validateWebhookSignature(input: {
    rawBody: string;
    signature: string | null;
  }): Promise<boolean>;
  parseWebhookEvent(rawBody: string): Promise<BillingWebhookEvent>;
};
