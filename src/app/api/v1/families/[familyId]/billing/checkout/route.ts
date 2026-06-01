import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { createCheckoutSession } from "@/server/plans";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    const session = await createCheckoutSession({ familyId, userId: user.id });

    return jsonData(session, { status: 201 });
  } catch (error) {
    return apiRouteError(error);
  }
}
