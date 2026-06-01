import { jsonData } from "@/lib/api-response";
import { apiRouteError, readJsonBody, requireAuth } from "@/server/auth";
import {
  inviteFamilyMember,
  type InviteFamilyMemberInput
} from "@/server/families";

type Context = {
  params: Promise<{ familyId: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    const input = await readJsonBody<InviteFamilyMemberInput>(request);
    const invitation = await inviteFamilyMember(user, familyId, input);

    return jsonData({ invitation }, { status: 202 });
  } catch (error) {
    return apiRouteError(error);
  }
}
