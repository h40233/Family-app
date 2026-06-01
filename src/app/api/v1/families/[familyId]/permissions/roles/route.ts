import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { listRolePermissions } from "@/server/permissions";

type Context = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    await requireAuth(request);
    const { familyId } = await context.params;
    const roles = await listRolePermissions(familyId);

    return jsonData({ roles });
  } catch (error) {
    return apiRouteError(error);
  }
}
