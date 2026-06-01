import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import { adjustPoints } from "@/server/points";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    await assertPermission({
      userId: user.id,
      familyId,
      resourceType: "point_ledger",
      action: "adjust_points"
    });
    const body = await request.json().catch(() => ({}));

    const entry = await adjustPoints({
      familyId,
      actorUserId: user.id,
      userId: String(body.userId ?? ""),
      delta: Number(body.delta ?? 0),
      reason: String(body.reason ?? "")
    });

    return jsonData(entry, { status: 201 });
  } catch (error) {
    return apiRouteError(error);
  }
}
