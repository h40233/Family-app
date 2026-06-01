import { jsonData } from "@/lib/api-response";
import { requireAuth } from "@/server/auth";
import { listNotifications, markAllNotificationsRead } from "@/server/notifications";

export async function GET(request: Request) {
  const user = await requireAuth(request);
  const notifications = await listNotifications(user.id);

  return jsonData(notifications);
}

export async function POST(request: Request) {
  const user = await requireAuth(request);
  const body = await request.json().catch(() => ({}));

  if (body.action === "read-all") {
    return jsonData(await markAllNotificationsRead(user.id));
  }

  return jsonData({ ignored: true });
}
