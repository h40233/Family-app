import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { createFundTransaction, listFundTransactions } from "@/server/funds";
import { assertPermission } from "@/server/permissions";

type RouteContext = {
  params: Promise<{ familyId: string; fundId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(_request);
    const { familyId, fundId } = await context.params;
    await assertPermission({
      userId: user.id,
      familyId,
      resourceType: "shared_fund",
      resourceId: fundId,
      action: "view"
    });
    const transactions = await listFundTransactions({ familyId, fundId });

    return jsonData(transactions);
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, fundId } = await context.params;
    await assertPermission({
      userId: user.id,
      familyId,
      resourceType: "shared_fund",
      resourceId: fundId,
      action: "manage_fund"
    });
    const body = await request.json().catch(() => ({}));

    const transaction = await createFundTransaction({
      familyId,
      fundId,
      actorUserId: user.id,
      type: body.type === "deposit" ? "deposit" : "expense",
      category: typeof body.category === "string" ? body.category : undefined,
      amount: Number(body.amount ?? 0),
      note: typeof body.note === "string" ? body.note : undefined,
      occurredAt: typeof body.occurredAt === "string" ? body.occurredAt : undefined
    });

    return jsonData(transaction, { status: 201 });
  } catch (error) {
    return apiRouteError(error);
  }
}
