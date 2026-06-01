import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { getEffectivePermissions } from "@/server/permissions";

type Context = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    const permissions = await getEffectivePermissions(user.id, familyId);

    return jsonData({ permissions });
  } catch (error) {
    return apiRouteError(error);
  }
}
