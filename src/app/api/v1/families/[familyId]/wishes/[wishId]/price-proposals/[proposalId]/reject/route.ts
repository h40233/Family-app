import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import { rejectWishPrice } from "@/server/wishes";

type RouteContext = {
  params: Promise<{ familyId: string; wishId: string; proposalId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, wishId, proposalId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "wish", resourceId: wishId, action: "update" });
    const wish = await rejectWishPrice({
      familyId,
      wishId,
      proposalId,
      actorUserId: user.id
    });

    return jsonData(wish);
  } catch (error) {
    return apiRouteError(error);
  }
}
