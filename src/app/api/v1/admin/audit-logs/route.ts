import { jsonData } from "@/lib/api-response";
import { apiRouteError } from "@/server/auth";
import { listAdminAuditLogs, requireAdmin } from "@/server/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return jsonData({ auditLogs: await listAdminAuditLogs() });
  } catch (error) {
    return apiRouteError(error);
  }
}
