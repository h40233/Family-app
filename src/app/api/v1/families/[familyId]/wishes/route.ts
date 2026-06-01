import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import { createWish, listWishes } from "@/server/wishes";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "wish", action: "view" });
    const { searchParams } = new URL(request.url);
    const wishes = await listWishes({
      familyId,
      status: searchParams.get("status") ?? undefined
    });

    return jsonData(wishes);
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "wish", action: "create" });
    const body = await request.json().catch(() => ({}));

    const wish = await createWish({
      familyId,
      actorUserId: user.id,
      title: String(body.title ?? ""),
      description: typeof body.description === "string" ? body.description : undefined,
      fulfillerId: String(body.fulfillerId ?? "")
    });

    return jsonData(wish, { status: 201 });
  } catch (error) {
    return apiRouteError(error);
  }
}
