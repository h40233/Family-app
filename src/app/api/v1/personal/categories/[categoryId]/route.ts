import { jsonData } from "@/lib/api-response";
import { requireAuth } from "@/server/auth";
import { deletePersonalCategory } from "@/server/money";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const user = await requireAuth(request);
  const { categoryId } = await context.params;
  const result = await deletePersonalCategory({ userId: user.id, categoryId });

  return jsonData(result);
}
