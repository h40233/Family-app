import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { createSharedFund, listSharedFunds } from "@/server/funds";
import { assertPermission } from "@/server/permissions";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(_request);
    const { familyId } = await context.params;
    await assertPermission({
      userId: user.id,
      familyId,
      resourceType: "shared_fund",
      action: "view"
    });
    const funds = await listSharedFunds(familyId);

    return jsonData(funds);
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    await assertPermission({
      userId: user.id,
      familyId,
      resourceType: "shared_fund",
      action: "create"
    });
    const body = await request.json().catch(() => ({}));

    const fund = await createSharedFund({
      familyId,
      actorUserId: user.id,
      name: String(body.name ?? "")
    });

    return jsonData(fund, { status: 201 });
  } catch (error) {
    return apiRouteError(error);
  }
}
