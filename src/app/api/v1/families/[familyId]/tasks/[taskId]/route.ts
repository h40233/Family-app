import { jsonData, jsonError } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import { deleteTask, getTask, updateTask } from "@/server/tasks";

type RouteContext = {
  params: Promise<{ familyId: string; taskId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, taskId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "task", resourceId: taskId, action: "view" });
    const task = await getTask({ familyId, taskId });

    if (!task) {
      return jsonError("NOT_FOUND", "Task not found.", 404);
    }

    return jsonData(task);
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, taskId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "task", resourceId: taskId, action: "update" });
    const body = await readJson(request);

    const task = await updateTask({
      familyId,
      taskId,
      actorUserId: user.id,
      title: optionalString(body.title),
      description: optionalString(body.description),
      assigneeIds: Array.isArray(body.assigneeIds) ? body.assigneeIds.map(String) : undefined,
      maxPoints: typeof body.maxPoints === "number" ? body.maxPoints : undefined,
      approvalMode: body.approvalMode === "auto" || body.approvalMode === "review" ? body.approvalMode : undefined,
      reviewerUserId:
        typeof body.reviewerUserId === "string" || body.reviewerUserId === null
          ? body.reviewerUserId
          : undefined,
      dueAt: typeof body.dueAt === "string" || body.dueAt === null ? body.dueAt : undefined,
      repeatRule: typeof body.repeatRule === "string" || body.repeatRule === null ? body.repeatRule : undefined
    });

    return jsonData(task);
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, taskId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "task", resourceId: taskId, action: "delete" });
    const result = await deleteTask({ familyId, taskId, actorUserId: user.id });

    return jsonData(result);
  } catch (error) {
    return apiRouteError(error);
  }
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  return request.json().catch(() => ({}));
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
