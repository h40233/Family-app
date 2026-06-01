import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { createBudget, listBudgets } from "@/server/budgets";
import type { BudgetPeriodType, BudgetTargetType } from "@/server/budgets";
import { assertPermission } from "@/server/permissions";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    await assertPermission({
      userId: user.id,
      familyId,
      resourceType: "report",
      action: "view"
    });

    const budgets = await listBudgets({ familyId, userId: user.id });
    return jsonData(budgets);
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
      resourceType: "report",
      action: "create"
    });
    const body = await request.json().catch(() => ({}));

    const budget = await createBudget({
      familyId,
      userId: user.id,
      name: String(body.name ?? ""),
      targetType: String(body.targetType ?? "personal_category") as BudgetTargetType,
      targetId: body.targetId ? String(body.targetId) : undefined,
      category: body.category ? String(body.category) : undefined,
      amount: Number(body.amount ?? 0),
      periodType: String(body.periodType ?? "monthly") as BudgetPeriodType,
      startAt: body.startAt ? String(body.startAt) : undefined,
      endAt: body.endAt ? String(body.endAt) : undefined
    });

    return jsonData(budget, { status: 201 });
  } catch (error) {
    return apiRouteError(error);
  }
}
