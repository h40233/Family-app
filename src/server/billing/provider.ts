import { mockBillingProvider } from "./mock-provider";
import type { BillingProvider, BillingProviderName } from "./types";

export function getBillingProvider(): BillingProvider {
  const provider = (process.env.FAMILY_OS_BILLING_PROVIDER ?? "mock") as BillingProviderName;

  if (provider === "mock") {
    return mockBillingProvider;
  }

  throw new Error(`Unsupported billing provider: ${provider}`);
}
