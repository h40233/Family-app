import { jsonData } from "@/lib/api-response";
import { requireAuth } from "@/server/auth";
import { markNotificationRead } from "@/server/notifications";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireAuth(request);
  const { notificationId } = await context.params;

  return jsonData(await markNotificationRead({ userId: user.id, notificationId }));
}
