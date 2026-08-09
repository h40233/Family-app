import { jsonData } from "@/lib/api-response";
import { apiRouteError, readJsonBody, requireAuth } from "@/server/auth";
import {
  assertPermission,
  updateRolePermissions,
  type FamilyRole,
  type Permission
} from "@/server/permissions";

type Context = {
  params: Promise<{ familyId: string; role: string }>;
};

type Body = {
  permissions: Permission[];
};

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireAuth(request);
    const { familyId, role } = await context.params;
    const familyRole = parseFamilyRole(role);
    const body = await readJsonBody<Body>(request);
    await assertPermission({ userId: user.id, familyId, resourceType: "family", action: "update" });
    const result = await updateRolePermissions(
      familyRole,
      body.permissions ?? [],
      familyId
    );

    return jsonData(result, { status: 202 });
  } catch (error) {
    return apiRouteError(error);
  }
}

function parseFamilyRole(role: string): FamilyRole {
  if (
    role === "owner" ||
    role === "admin" ||
    role === "member" ||
    role === "child" ||
    role === "viewer"
  ) {
    return role;
  }

  throw new Error(`Invalid family role: ${role}`);
}
