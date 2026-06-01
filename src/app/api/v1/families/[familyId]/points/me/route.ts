import { jsonData } from "@/lib/api-response";
import { requireAuth } from "@/server/auth";
import { getMyPointBalance } from "@/server/points";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const user = await requireAuth(request);
  const { familyId } = await context.params;
  const balance = await getMyPointBalance({ familyId, actorUserId: user.id });

  return jsonData(balance);
}
