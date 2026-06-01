import { jsonData } from "@/lib/api-response";
import { apiRouteError } from "@/server/auth";
import { getAdminMetrics, requireAdmin } from "@/server/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return jsonData({ metrics: await getAdminMetrics() });
  } catch (error) {
    return apiRouteError(error);
  }
}
