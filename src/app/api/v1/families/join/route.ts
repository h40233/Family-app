import { jsonData } from "@/lib/api-response";
import { apiRouteError, readJsonBody, requireAuth } from "@/server/auth";
import { joinFamily, type JoinFamilyInput } from "@/server/families";

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const input = await readJsonBody<JoinFamilyInput>(request);
    const member = await joinFamily(user, input);

    return jsonData({ member }, { status: 202 });
  } catch (error) {
    return apiRouteError(error);
  }
}
