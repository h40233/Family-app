const required = ["DATABASE_URL", "DIRECT_URL"];
const webPush = [
  "NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY",
  "WEB_PUSH_PRIVATE_KEY",
  "WEB_PUSH_VAPID_SUBJECT"
];
const optional = ["FAMILY_OS_BASE_URL", ...webPush];
const billingProvider = process.env.FAMILY_OS_BILLING_PROVIDER ?? "mock";

const missing = required.filter((key) => !process.env[key]);
const missingWebPush = webPush.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

if (process.env.NODE_ENV === "production" && missingWebPush.length > 0) {
  console.error(
    `Missing production Web Push environment variables: ${missingWebPush.join(", ")}`
  );
  process.exit(1);
}

if (
  process.env.NODE_ENV === "production" &&
  billingProvider === "mock" &&
  process.env.FAMILY_OS_ALLOW_MOCK_BILLING !== "true"
) {
  console.error("Mock billing provider cannot be used in production.");
  process.exit(1);
}

if (process.env.NODE_ENV === "production" && !process.env.FAMILY_OS_BILLING_WEBHOOK_SECRET) {
  console.error("Missing production billing webhook secret: FAMILY_OS_BILLING_WEBHOOK_SECRET");
  process.exit(1);
}

for (const key of optional) {
  if (!process.env[key]) {
    console.warn(`Optional environment variable is not set: ${key}`);
  }
}

if (missingWebPush.length > 0) {
  console.warn(
    `Web Push delivery will be skipped until VAPID is configured: ${missingWebPush.join(", ")}`
  );
}

console.log("Environment check passed.");
