import { jsonData, jsonError } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import { deleteWish, getWish } from "@/server/wishes";

type RouteContext = {
  params: Promise<{ familyId: string; wishId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, wishId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "wish", resourceId: wishId, action: "view" });
    const wish = await getWish({ familyId, wishId });

    if (!wish) {
      return jsonError("NOT_FOUND", "Wish not found.", 404);
    }

    return jsonData(wish);
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, wishId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "wish", resourceId: wishId, action: "delete" });
    const wish = await deleteWish({ familyId, wishId, actorUserId: user.id });

    return jsonData(wish);
  } catch (error) {
    return apiRouteError(error);
  }
}
