import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import { createTask, listTasks } from "@/server/tasks";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "task", action: "view" });
    const { searchParams } = new URL(request.url);

    const tasks = await listTasks({
      familyId,
      status: searchParams.get("status") as never,
      assigneeId: searchParams.get("assigneeId") ?? undefined
    });

    return jsonData(tasks);
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "task", action: "create" });
    const body = await readJson(request);

    const task = await createTask({
      familyId,
      actorUserId: user.id,
      title: String(body.title ?? ""),
      description: optionalString(body.description),
      assigneeIds: Array.isArray(body.assigneeIds) ? body.assigneeIds.map(String) : [],
      maxPoints: Number(body.maxPoints ?? 0),
      approvalMode: body.approvalMode === "auto" ? "auto" : "review",
      reviewerUserId: optionalString(body.reviewerUserId),
      dueAt: optionalString(body.dueAt),
      repeatRule: optionalString(body.repeatRule)
    });

    return jsonData(task, { status: 201 });
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
