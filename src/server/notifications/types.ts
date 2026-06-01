export type NotificationType =
  | "task_assigned"
  | "task_pending_review"
  | "points_changed"
  | "wish_status_changed"
  | "budget_exceeded";

export type AppNotification = {
  id: string;
  userId: string;
  familyId?: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
};

export type PushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

export type PushSubscriptionRecord = {
  id: string;
  userId: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreatePushSubscriptionInput = {
  userId: string;
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string;
};

export type PushNotificationPayload = {
  title: string;
  body: string;
  url: string;
  notificationId: string;
  type: NotificationType;
  familyId?: string;
};

export type PushDeliveryResult =
  | {
      status: "sent";
      subscriptionId: string;
    }
  | {
      status: "removed";
      subscriptionId: string;
      reason: string;
    }
  | {
      status: "failed";
      subscriptionId: string;
      reason: string;
      statusCode?: number;
    };

export type PushDeliverySummary = {
  attempted: number;
  sent: number;
  removed: number;
  failed: number;
  skipped: boolean;
  skipReason?: string;
  results: PushDeliveryResult[];
};

export type NotificationPushSender = {
  send(
    subscription: PushSubscriptionRecord,
    payload: PushNotificationPayload
  ): Promise<void>;
};

export type CreateNotificationInput = Omit<AppNotification, "id" | "readAt" | "createdAt"> & {
  deliverPush?: boolean;
  pushSender?: NotificationPushSender;
};
