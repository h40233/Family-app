import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import {
  createPushSubscription,
  listPushSubscriptions
} from "@/server/notifications";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const subscriptions = await listPushSubscriptions(user.id);

    return jsonData(subscriptions);
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await request.json().catch(() => ({}));

    const subscription = await createPushSubscription({
      userId: user.id,
      endpoint: String(body.endpoint ?? ""),
      keys: {
        p256dh: String(body.keys?.p256dh ?? ""),
        auth: String(body.keys?.auth ?? "")
      },
      userAgent: request.headers.get("user-agent") ?? undefined
    });

    return jsonData(subscription, { status: 201 });
  } catch (error) {
    return apiRouteError(error);
  }
}
