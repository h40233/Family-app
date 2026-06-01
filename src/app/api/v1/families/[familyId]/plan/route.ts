import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { getFamilyPlanStatus } from "@/server/plans";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAuth(request);
    const { familyId } = await context.params;
    const status = await getFamilyPlanStatus(familyId);

    return jsonData({
      familyId: status.familyId,
      plan: status.plan
    });
  } catch (error) {
    return apiRouteError(error);
  }
}
