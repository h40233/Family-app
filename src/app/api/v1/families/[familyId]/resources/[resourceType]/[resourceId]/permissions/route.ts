import { jsonData } from "@/lib/api-response";
import { apiRouteError, readJsonBody, requireAuth } from "@/server/auth";
import {
  assertPermission,
  getResourcePermissionOverrides,
  updateResourcePermissionOverrides,
  type ResourcePermissionOverride
} from "@/server/permissions";

type Context = {
  params: Promise<{
    familyId: string;
    resourceType: string;
    resourceId: string;
  }>;
};

type Body = {
  overrides: ResourcePermissionOverride[];
};

export async function GET(request: Request, context: Context) {
  try {
    await requireAuth(request);
    const { familyId, resourceType, resourceId } = await context.params;
    const overrides = await getResourcePermissionOverrides(
      familyId,
      resourceType,
      resourceId
    );

    return jsonData({ overrides });
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await requireAuth(request);
    const { familyId, resourceType, resourceId } = await context.params;
    const body = await readJsonBody<Body>(request);
    await assertPermission({ userId: user.id, familyId, resourceType: "family", action: "update" });
    const result = await updateResourcePermissionOverrides(
      familyId,
      resourceType,
      resourceId,
      body.overrides ?? []
    );

    return jsonData(result, { status: 202 });
  } catch (error) {
    return apiRouteError(error);
  }
}
