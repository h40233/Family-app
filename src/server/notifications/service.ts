import { usesDatabaseRuntime } from "@/server/data-source";
import { prisma } from "@/server/db/prisma";
import { createId, getMemoryStore, nowIso } from "@/server/store";
import type { Prisma } from "@prisma/client";
import type {
  AppNotification,
  CreateNotificationInput,
  CreatePushSubscriptionInput,
  PushDeliverySummary,
  PushNotificationPayload,
  PushSubscriptionRecord
} from "./types";
import {
  createWebPushSender,
  getPushErrorReason,
  getPushErrorStatusCode,
  getWebPushConfig,
  isGonePushSubscriptionError,
  type WebPushSender
} from "./push-sender";

export async function createNotification(
  input: CreateNotificationInput
): Promise<AppNotification> {
  const { deliverPush = true, pushSender, ...notificationInput } = input;
  let notification: AppNotification;

  if (usesDatabaseRuntime("notifications")) {
    const storedNotification = await prisma.notification.create({
      data: {
        userId: notificationInput.userId,
        familyId: notificationInput.familyId,
        type: notificationInput.type,
        title: notificationInput.title,
        body: notificationInput.body,
        data: toJsonObject(notificationInput.data)
      }
    });

    notification = toAppNotification(storedNotification);
  } else {
    notification = {
      id: createId("notification"),
      ...notificationInput,
      createdAt: nowIso()
    };

    getMemoryStore().notifications.push(notification);
  }

  if (deliverPush) {
    if (pushSender) {
      await deliverNotificationPush(notification, pushSender);
    } else {
      await deliverNotificationPush(notification);
    }
  }

  return notification;
}

export async function deliverNotificationPush(
  notification: AppNotification,
  sender: WebPushSender | undefined = createWebPushSender()
): Promise<PushDeliverySummary> {
  const subscriptions = await listPushSubscriptions(notification.userId);
  const config = getWebPushConfig();
  const senderWasInjected = arguments.length > 1;

  if (!sender || (!senderWasInjected && !config.enabled)) {
    return {
      attempted: 0,
      sent: 0,
      removed: 0,
      failed: 0,
      skipped: true,
      skipReason: config.skipReason ?? "Web Push skipped; sender is not configured.",
      results: []
    };
  }

  const payload = toPushPayload(notification);
  const summary: PushDeliverySummary = {
    attempted: subscriptions.length,
    sent: 0,
    removed: 0,
    failed: 0,
    skipped: false,
    results: []
  };

  for (const subscription of subscriptions) {
    try {
      await sender.send(subscription, payload);
      summary.sent += 1;
      summary.results.push({ status: "sent", subscriptionId: subscription.id });
    } catch (error) {
      const reason = getPushErrorReason(error);
      const statusCode = getPushErrorStatusCode(error);

      if (isGonePushSubscriptionError(error)) {
        await deletePushSubscription({
          userId: subscription.userId,
          subscriptionId: subscription.id
        });
        summary.removed += 1;
        summary.results.push({
          status: "removed",
          subscriptionId: subscription.id,
          reason
        });
        continue;
      }

      summary.failed += 1;
      summary.results.push({
        status: "failed",
        subscriptionId: subscription.id,
        reason,
        statusCode
      });
    }
  }

  return summary;
}

export async function listNotifications(userId: string): Promise<AppNotification[]> {
  if (usesDatabaseRuntime("notifications")) {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    return notifications.map(toAppNotification);
  }

  return getMemoryStore().notifications
    .filter((notification) => notification.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markNotificationRead(input: {
  userId: string;
  notificationId: string;
}): Promise<AppNotification> {
  if (usesDatabaseRuntime("notifications")) {
    const notification = await prisma.notification.findFirst({
      where: {
        id: input.notificationId,
        userId: input.userId
      }
    });

    if (!notification) {
      throw new Error("Notification not found.");
    }

    return toAppNotification(
      await prisma.notification.update({
        where: { id: notification.id },
        data: { readAt: new Date() }
      })
    );
  }

  const notification = getMemoryStore().notifications.find(
    (item) => item.id === input.notificationId && item.userId === input.userId
  );

  if (!notification) {
    throw new Error("Notification not found.");
  }

  notification.readAt = nowIso();

  return notification;
}

export async function markAllNotificationsRead(userId: string) {
  if (usesDatabaseRuntime("notifications")) {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null
      },
      data: { readAt: new Date() }
    });

    return { updated: result.count };
  }

  const readAt = nowIso();
  const notifications = getMemoryStore().notifications.filter(
    (notification) => notification.userId === userId && !notification.readAt
  );

  for (const notification of notifications) {
    notification.readAt = readAt;
  }

  return { updated: notifications.length };
}

export async function listPushSubscriptions(
  userId: string
): Promise<PushSubscriptionRecord[]> {
  if (usesDatabaseRuntime("notifications")) {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    return subscriptions.map(toPushSubscriptionRecord);
  }

  return getMemoryStore().pushSubscriptions
    .filter((subscription) => subscription.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createPushSubscription(
  input: CreatePushSubscriptionInput
): Promise<PushSubscriptionRecord> {
  if (!input.endpoint.trim()) {
    throw new Error("Push endpoint is required.");
  }
  if (!input.keys.p256dh || !input.keys.auth) {
    throw new Error("Push subscription keys are required.");
  }

  if (usesDatabaseRuntime("notifications")) {
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint: input.endpoint }
    });

    if (existing) {
      const updated = await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          userId: input.userId,
          keys: toJsonObject(input.keys)
        }
      });

      return toPushSubscriptionRecord(updated);
    }

    const subscription = await prisma.pushSubscription.create({
      data: {
        userId: input.userId,
        endpoint: input.endpoint,
        keys: toJsonObject(input.keys)
      }
    });

    return toPushSubscriptionRecord(subscription);
  }

  const store = getMemoryStore();
  const existing = store.pushSubscriptions.find(
    (subscription) => subscription.endpoint === input.endpoint
  );
  const timestamp = nowIso();

  if (existing) {
    existing.userId = input.userId;
    existing.keys = input.keys;
    existing.userAgent = input.userAgent;
    existing.updatedAt = timestamp;
    return existing;
  }

  const subscription: PushSubscriptionRecord = {
    id: createId("push_subscription"),
    userId: input.userId,
    endpoint: input.endpoint,
    keys: input.keys,
    userAgent: input.userAgent,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  store.pushSubscriptions.push(subscription);

  return subscription;
}

export async function deletePushSubscription(input: {
  userId: string;
  subscriptionId: string;
}) {
  if (usesDatabaseRuntime("notifications")) {
    const subscription = await prisma.pushSubscription.findFirst({
      where: {
        id: input.subscriptionId,
        userId: input.userId
      }
    });

    if (!subscription) {
      throw new Error("Push subscription not found.");
    }

    await prisma.pushSubscription.delete({ where: { id: subscription.id } });

    return { id: subscription.id, deleted: true };
  }

  const store = getMemoryStore();
  const subscription = store.pushSubscriptions.find(
    (item) => item.id === input.subscriptionId && item.userId === input.userId
  );

  if (!subscription) {
    throw new Error("Push subscription not found.");
  }

  store.pushSubscriptions = store.pushSubscriptions.filter(
    (item) => item.id !== subscription.id
  );

  return { id: subscription.id, deleted: true };
}

function toAppNotification(notification: {
  id: string;
  userId: string;
  familyId: string | null;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}): AppNotification {
  return {
    id: notification.id,
    userId: notification.userId,
    familyId: notification.familyId ?? undefined,
    type: toNotificationType(notification.type),
    title: notification.title,
    body: notification.body,
    data: isRecord(notification.data) ? notification.data : {},
    readAt: notification.readAt?.toISOString(),
    createdAt: notification.createdAt.toISOString()
  };
}

function toPushSubscriptionRecord(subscription: {
  id: string;
  userId: string;
  endpoint: string;
  keys: unknown;
  createdAt: Date;
}): PushSubscriptionRecord {
  const keys = isRecord(subscription.keys) ? subscription.keys : {};
  return {
    id: subscription.id,
    userId: subscription.userId,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: typeof keys.p256dh === "string" ? keys.p256dh : "",
      auth: typeof keys.auth === "string" ? keys.auth : ""
    },
    createdAt: subscription.createdAt.toISOString(),
    updatedAt: subscription.createdAt.toISOString()
  };
}

function toNotificationType(type: string): AppNotification["type"] {
  if (
    type === "task_assigned" ||
    type === "task_pending_review" ||
    type === "points_changed" ||
    type === "wish_status_changed" ||
    type === "budget_exceeded"
  ) {
    return type;
  }

  return "points_changed";
}

function toPushPayload(notification: AppNotification): PushNotificationPayload {
  const url = typeof notification.data?.url === "string" ? notification.data.url : "/notifications";

  return {
    title: notification.title,
    body: notification.body,
    url,
    notificationId: notification.id,
    type: notification.type,
    familyId: notification.familyId
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toJsonObject(value: Record<string, unknown> | undefined): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonObject;
}
