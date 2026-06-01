import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import { getReportsSummary } from "@/server/reports";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    await assertPermission({
      userId: user.id,
      familyId,
      resourceType: "report",
      action: "view"
    });
    const summary = await getReportsSummary({ familyId, userId: user.id });

    return jsonData(summary);
  } catch (error) {
    return apiRouteError(error);
  }
}
