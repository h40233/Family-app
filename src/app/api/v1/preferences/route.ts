import { jsonData } from "@/lib/api-response";
import { apiRouteError, readJsonBody, requireAuth } from "@/server/auth";
import { getUserPreferences, updateUserPreferences, type ThemeId } from "@/server/preferences";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const preferences = await getUserPreferences({
      userId: user.id,
      familyId: searchParams.get("familyId") ?? undefined
    });

    return jsonData({ preferences });
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await readJsonBody<{ familyId?: string; theme?: string }>(request);
    const preferences = await updateUserPreferences({
      userId: user.id,
      familyId: body.familyId,
      theme: String(body.theme ?? "classic") as ThemeId
    });

    return jsonData({ preferences });
  } catch (error) {
    return apiRouteError(error);
  }
}
