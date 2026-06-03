import { jsonData } from "@/lib/api-response";
import { requireAuth } from "@/server/auth";
import { deletePersonalAccount } from "@/server/money";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const user = await requireAuth(request);
  const { accountId } = await context.params;
  const result = await deletePersonalAccount({ userId: user.id, accountId });

  return jsonData(result);
}
