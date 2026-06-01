import { jsonData } from "@/lib/api-response";
import { apiRouteError, readJsonBody, requireAuth } from "@/server/auth";
import {
  checkPermission,
  type PermissionAction,
  type ResourceType
} from "@/server/permissions";

type Body = {
  familyId: string;
  resourceType: ResourceType;
  resourceId?: string;
  action: PermissionAction;
};

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const body = await readJsonBody<Body>(request);
    const result = await checkPermission({
      userId: user.id,
      familyId: body.familyId,
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      action: body.action
    });

    return jsonData(result);
  } catch (error) {
    return apiRouteError(error);
  }
}
