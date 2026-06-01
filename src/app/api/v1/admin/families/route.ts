import { jsonData } from "@/lib/api-response";
import { apiRouteError } from "@/server/auth";
import { listAdminFamilies, requireAdmin } from "@/server/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return jsonData({ families: await listAdminFamilies() });
  } catch (error) {
    return apiRouteError(error);
  }
}
