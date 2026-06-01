import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import { assertPermission } from "@/server/permissions";
import { completeTask } from "@/server/tasks";

type RouteContext = {
  params: Promise<{ familyId: string; taskId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId, taskId } = await context.params;
    await assertPermission({ userId: user.id, familyId, resourceType: "task", resourceId: taskId, action: "view" });
    const body = await request.json().catch(() => ({}));

    const completion = await completeTask({
      familyId,
      taskId,
      actorUserId: user.id,
      note: typeof body.note === "string" ? body.note : undefined
    });

    return jsonData(completion, { status: 201 });
  } catch (error) {
    return apiRouteError(error);
  }
}
