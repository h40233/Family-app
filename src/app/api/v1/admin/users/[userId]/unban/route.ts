import { jsonData } from "@/lib/api-response";
import { apiRouteError } from "@/server/auth";
import { requireAdmin, setUserBan } from "@/server/admin";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const actor = await requireAdmin(request);
    const { userId } = await context.params;

    return jsonData({
      ban: await setUserBan({
        actorUserId: actor.id,
        userId,
        banned: false
      })
    });
  } catch (error) {
    return apiRouteError(error);
  }
}
