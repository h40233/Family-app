import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { listFamilyPersonalSharing } from "@/server/money";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;

    return jsonData(await listFamilyPersonalSharing({ viewerUserId: user.id, familyId }));
  } catch (error) {
    return apiRouteError(error);
  }
}
