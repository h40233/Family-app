import { jsonData } from "@/lib/api-response";
import { apiRouteError, readJsonBody } from "@/server/auth";
import {
  listAdminAdPlacements,
  requireAdmin,
  updateAdminAdPlacement
} from "@/server/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return jsonData({ ads: await listAdminAdPlacements() });
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const body = await readJsonBody<{
      placementId?: string;
      enabled?: boolean;
      label?: string;
    }>(request);

    return jsonData({
      ad: await updateAdminAdPlacement({
        actorUserId: actor.id,
        placementId: String(body.placementId ?? ""),
        enabled: Boolean(body.enabled),
        label: body.label
      })
    });
  } catch (error) {
    return apiRouteError(error);
  }
}
