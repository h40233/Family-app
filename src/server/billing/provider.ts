import { mockBillingProvider } from "./mock-provider";
import type { BillingProvider, BillingProviderName } from "./types";

export function getBillingProvider(): BillingProvider {
  const provider = (process.env.FAMILY_OS_BILLING_PROVIDER ?? "mock") as BillingProviderName;

  if (provider === "mock") {
    if (
      process.env.NODE_ENV === "production" &&
      process.env.FAMILY_OS_ALLOW_MOCK_BILLING !== "true"
    ) {
      throw new Error("Mock billing provider cannot be used in production.");
    }

    return mockBillingProvider;
  }

  throw new Error(`Unsupported billing provider: ${provider}`);
}
