import { jsonData } from "@/lib/api-response";
import { apiRouteError, readJsonBody, requireAuth } from "@/server/auth";
import { createChildAccount, type CreateChildAccountInput } from "@/server/families";

type Context = {
  params: Promise<{ familyId: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    const input = await readJsonBody<CreateChildAccountInput>(request);
    const member = await createChildAccount(user, familyId, input);

    return jsonData({ member }, { status: 202 });
  } catch (error) {
    return apiRouteError(error);
  }
}
