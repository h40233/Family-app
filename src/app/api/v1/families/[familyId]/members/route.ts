import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { listFamilyMembers } from "@/server/families";

type Context = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    const members = await listFamilyMembers(user, familyId);

    return jsonData({ members });
  } catch (error) {
    return apiRouteError(error);
  }
}
