import { jsonData } from "@/lib/api-response";
import { apiRouteError } from "@/server/auth";
import { listAdminUsers, requireAdmin } from "@/server/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return jsonData({ users: await listAdminUsers() });
  } catch (error) {
    return apiRouteError(error);
  }
}
