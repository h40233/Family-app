import webPush from "web-push";
import type { PushSubscriptionRecord, PushNotificationPayload } from "./types";

export type WebPushConfig = {
  enabled: boolean;
  publicKey?: string;
  privateKey?: string;
  subject?: string;
  missing: string[];
  skipReason?: string;
};

export type WebPushSendError = Error & {
  statusCode?: number;
};

export type WebPushSender = {
  send(
    subscription: PushSubscriptionRecord,
    payload: PushNotificationPayload
  ): Promise<void>;
};

export function getWebPushConfig(env: NodeJS.ProcessEnv = process.env): WebPushConfig {
  const required = {
    NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY,
    WEB_PUSH_PRIVATE_KEY: env.WEB_PUSH_PRIVATE_KEY,
    WEB_PUSH_VAPID_SUBJECT: env.WEB_PUSH_VAPID_SUBJECT
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return {
      enabled: false,
      missing,
      skipReason: `Web Push skipped; missing VAPID env vars: ${missing.join(", ")}.`
    };
  }

  return {
    enabled: true,
    publicKey: required.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY,
    privateKey: required.WEB_PUSH_PRIVATE_KEY,
    subject: required.WEB_PUSH_VAPID_SUBJECT,
    missing: []
  };
}

export function createWebPushSender(
  config: WebPushConfig = getWebPushConfig()
): WebPushSender | undefined {
  if (!config.enabled || !config.publicKey || !config.privateKey || !config.subject) {
    return undefined;
  }

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  return {
    async send(subscription, payload) {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys
        },
        JSON.stringify(payload)
      );
    }
  };
}

export function isGonePushSubscriptionError(error: unknown): boolean {
  const statusCode = getPushErrorStatusCode(error);
  return statusCode === 404 || statusCode === 410;
}

export function getPushErrorStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const statusCode = (error as WebPushSendError).statusCode;
    return typeof statusCode === "number" ? statusCode : undefined;
  }

  return undefined;
}

export function getPushErrorReason(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown Web Push delivery error.";
}
