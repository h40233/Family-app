import { beforeEach, describe, expect, it, vi } from "vitest";
import { adjustPoints } from "@/server/points";
import { resetMemoryStore } from "@/server/store";
import {
  createNotification,
  createPushSubscription,
  deliverNotificationPush,
  listNotifications,
  listPushSubscriptions,
  markAllNotificationsRead
} from "./service";

const familyId = "00000000-0000-4000-8000-000000001001";
const userId = "00000000-0000-4000-8000-000000000001";

describe("notification service", () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it("records notifications when point ledger changes", async () => {
    await adjustPoints({
      familyId,
      actorUserId: userId,
      userId,
      delta: 15,
      reason: "MVP points adjustment"
    });

    const notifications = await listNotifications(userId);

    expect(notifications.some((notification) => notification.type === "points_changed")).toBe(true);
  });

  it("marks all notifications as read", async () => {
    const result = await markAllNotificationsRead(userId);
    const notifications = await listNotifications(userId);

    expect(result.updated).toBeGreaterThan(0);
    expect(notifications.every((notification) => notification.readAt)).toBe(true);
  });

  it("delivers Web Push when a notification is created with a sender", async () => {
    await createPushSubscription({
      userId,
      endpoint: "https://push.example.test/send",
      keys: {
        p256dh: "public-key",
        auth: "auth-secret"
      }
    });
    const send = vi.fn().mockResolvedValue(undefined);

    const notification = await createNotification({
      userId,
      familyId,
      type: "points_changed",
      title: "Points updated",
      body: "You earned points.",
      data: { url: "/points" },
      pushSender: { send }
    });

    expect(notification.id).toBeTruthy();
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][1]).toMatchObject({
      title: "Points updated",
      body: "You earned points.",
      url: "/points",
      notificationId: notification.id,
      type: "points_changed"
    });
  });

  it("skips Web Push clearly when VAPID is not configured", async () => {
    const previousPublicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
    const previousPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY;
    const previousSubject = process.env.WEB_PUSH_VAPID_SUBJECT;
    delete process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
    delete process.env.WEB_PUSH_PRIVATE_KEY;
    delete process.env.WEB_PUSH_VAPID_SUBJECT;

    await createPushSubscription({
      userId,
      endpoint: "https://push.example.test/skipped",
      keys: {
        p256dh: "public-key",
        auth: "auth-secret"
      }
    });

    const summary = await deliverNotificationPush({
      id: "notification-test",
      userId,
      familyId,
      type: "points_changed",
      title: "Points updated",
      body: "You earned points.",
      createdAt: new Date().toISOString()
    });

    expect(summary).toMatchObject({
      attempted: 0,
      skipped: true
    });
    expect(summary.skipReason).toContain("missing VAPID env vars");

    restoreEnv("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY", previousPublicKey);
    restoreEnv("WEB_PUSH_PRIVATE_KEY", previousPrivateKey);
    restoreEnv("WEB_PUSH_VAPID_SUBJECT", previousSubject);
  });

  it("removes expired push subscriptions after 404 or 410 delivery responses", async () => {
    const subscription = await createPushSubscription({
      userId,
      endpoint: "https://push.example.test/gone",
      keys: {
        p256dh: "public-key",
        auth: "auth-secret"
      }
    });
    const error = new Error("Subscription is gone") as Error & { statusCode: number };
    error.statusCode = 410;

    const summary = await deliverNotificationPush(
      {
        id: "notification-test",
        userId,
        familyId,
        type: "points_changed",
        title: "Points updated",
        body: "You earned points.",
        createdAt: new Date().toISOString()
      },
      { send: vi.fn().mockRejectedValue(error) }
    );

    expect(summary).toMatchObject({
      attempted: 1,
      removed: 1,
      failed: 0,
      results: [{ status: "removed", subscriptionId: subscription.id }]
    });
    await expect(listPushSubscriptions(userId)).resolves.toHaveLength(0);
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
