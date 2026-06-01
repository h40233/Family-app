import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import { proposeWishPrice } from "@/server/wishes";

type RouteContext = {
  params: Promise<{ familyId: string; wishId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, wishId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "wish", resourceId: wishId, action: "update" });
    const body = await request.json().catch(() => ({}));

    const proposal = await proposeWishPrice({
      familyId,
      wishId,
      actorUserId: user.id,
      points: Number(body.points ?? 0),
      note: typeof body.note === "string" ? body.note : undefined
    });

    return jsonData(proposal, { status: 201 });
  } catch (error) {
    return apiRouteError(error);
  }
}
