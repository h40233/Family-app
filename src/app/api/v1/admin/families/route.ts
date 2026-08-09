import { jsonData } from "@/lib/api-response";
import { apiRouteError } from "@/server/auth";
import { listAdminFamilies, requireAdmin } from "@/server/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const result = await listAdminFamilies(readAdminListQuery(request));
    return jsonData({ families: result.items, nextCursor: result.nextCursor });
  } catch (error) {
    return apiRouteError(error);
  }
}

function readAdminListQuery(request: Request) {
  const { searchParams } = new URL(request.url);
  return {
    search: searchParams.get("search") ?? undefined,
    limit: Number(searchParams.get("limit") ?? undefined) || undefined,
    cursor: searchParams.get("cursor")
  };
}
