import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import { rejectWish } from "@/server/wishes";

type RouteContext = {
  params: Promise<{ familyId: string; wishId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, wishId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "wish", resourceId: wishId, action: "update" });
    const wish = await rejectWish({ familyId, wishId, actorUserId: user.id });

    return jsonData(wish);
  } catch (error) {
    return apiRouteError(error);
  }
}
