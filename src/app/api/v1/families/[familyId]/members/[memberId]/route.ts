import { jsonData } from "@/lib/api-response";
import { apiRouteError, readJsonBody, requireAuth } from "@/server/auth";
import {
  removeFamilyMember,
  updateFamilyMember,
  type UpdateFamilyMemberInput
} from "@/server/families";
import { assertPermission } from "@/server/permissions";

type Context = {
  params: Promise<{ familyId: string; memberId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireAuth(request);
    const { familyId, memberId } = await context.params;
    const input = await readJsonBody<UpdateFamilyMemberInput>(request);
    await assertPermission({ userId: user.id, familyId, resourceType: "member", resourceId: memberId, action: "update" });
    const member = await updateFamilyMember(user, familyId, memberId, input);

    return jsonData({ member }, { status: 202 });
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const user = await requireAuth(request);
    const { familyId, memberId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "member", resourceId: memberId, action: "delete" });
    const result = await removeFamilyMember(user, familyId, memberId);

    return jsonData(result, { status: 202 });
  } catch (error) {
    return apiRouteError(error);
  }
}
