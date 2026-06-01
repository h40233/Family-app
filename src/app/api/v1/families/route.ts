import { jsonData } from "@/lib/api-response";
import { apiRouteError, readJsonBody, requireAuth } from "@/server/auth";
import {
  createFamily,
  listFamiliesForUser,
  type CreateFamilyInput
} from "@/server/families";

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const families = await listFamiliesForUser(user);

    return jsonData({ families });
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const input = await readJsonBody<CreateFamilyInput>(request);
    const family = await createFamily(user, input);

    return jsonData({ family }, { status: 202 });
  } catch (error) {
    return apiRouteError(error);
  }
}
