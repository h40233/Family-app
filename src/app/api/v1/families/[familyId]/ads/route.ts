import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { getFamilyAdPlacement } from "@/server/ads";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAuth(request);
    const { familyId } = await context.params;
    const { searchParams } = new URL(request.url);
    const ad = await getFamilyAdPlacement({
      familyId,
      placement: searchParams.get("placement") ?? ""
    });

    return jsonData({ ad });
  } catch (error) {
    return apiRouteError(error);
  }
}
