import { jsonData } from "@/lib/api-response";
import { apiRouteError, readJsonBody, requireAuth } from "@/server/auth";
import { getFamily, updateFamily, type UpdateFamilyInput } from "@/server/families";

type Context = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    const family = await getFamily(user, familyId);

    return jsonData({ family });
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    const input = await readJsonBody<UpdateFamilyInput>(request);
    const family = await updateFamily(user, familyId, input);

    return jsonData({ family }, { status: 202 });
  } catch (error) {
    return apiRouteError(error);
  }
}
