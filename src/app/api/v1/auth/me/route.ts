import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);

    return jsonData({ user });
  } catch (error) {
    return apiRouteError(error);
  }
}
