import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { deletePushSubscription } from "@/server/notifications";

type RouteContext = {
  params: Promise<{ subscriptionId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { subscriptionId } = await context.params;

    return jsonData(await deletePushSubscription({ userId: user.id, subscriptionId }));
  } catch (error) {
    return apiRouteError(error);
  }
}
