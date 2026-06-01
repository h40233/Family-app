import { jsonData } from "@/lib/api-response";
import { apiRouteError, clearSessionCookie, logout, requireAuth } from "@/server/auth";

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const result = await logout(request);

    return jsonData(result, {
      status: 200,
      headers: { "set-cookie": clearSessionCookie() }
    });
  } catch (error) {
    return apiRouteError(error);
  }
}
