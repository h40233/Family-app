import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { deleteBudget, updateBudget } from "@/server/budgets";
import type { BudgetPeriodType, BudgetTargetType } from "@/server/budgets";
import { assertPermission } from "@/server/permissions";

type RouteContext = {
  params: Promise<{ familyId: string; budgetId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, budgetId } = await context.params;
    await assertPermission({
      userId: user.id,
      familyId,
      resourceType: "report",
      action: "update"
    });
    const body = await request.json().catch(() => ({}));

    const budget = await updateBudget({
      familyId,
      budgetId,
      userId: user.id,
      name: body.name === undefined ? undefined : String(body.name),
      targetType:
        body.targetType === undefined
          ? undefined
          : (String(body.targetType) as BudgetTargetType),
      targetId: body.targetId === undefined ? undefined : String(body.targetId),
      category: body.category === undefined ? undefined : String(body.category),
      amount: body.amount === undefined ? undefined : Number(body.amount),
      periodType:
        body.periodType === undefined
          ? undefined
          : (String(body.periodType) as BudgetPeriodType),
      startAt: body.startAt === undefined ? undefined : String(body.startAt),
      endAt: body.endAt === undefined ? undefined : String(body.endAt)
    });

    return jsonData(budget);
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, budgetId } = await context.params;
    await assertPermission({
      userId: user.id,
      familyId,
      resourceType: "report",
      action: "delete"
    });

    const result = await deleteBudget({ familyId, budgetId });
    return jsonData(result);
  } catch (error) {
    return apiRouteError(error);
  }
}
