import { jsonData } from "@/lib/api-response";
import { requireAuth } from "@/server/auth";
import { createPersonalTransaction, listPersonalTransactions } from "@/server/money";

type RouteContext = {
  params: Promise<{ accountId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const user = await requireAuth(request);
  const { accountId } = await context.params;
  const transactions = await listPersonalTransactions({ userId: user.id, accountId });

  return jsonData(transactions);
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireAuth(request);
  const { accountId } = await context.params;
  const body = await request.json().catch(() => ({}));

  const transaction = await createPersonalTransaction({
    userId: user.id,
    accountId,
    clientMutationId: typeof body.clientMutationId === "string" ? body.clientMutationId : undefined,
    type: body.type === "income" ? "income" : "expense",
    categoryId: typeof body.categoryId === "string" ? body.categoryId : undefined,
    category: typeof body.category === "string" ? body.category : undefined,
    amount: Number(body.amount ?? 0),
    note: typeof body.note === "string" ? body.note : undefined,
    occurredAt: typeof body.occurredAt === "string" ? body.occurredAt : undefined
  });

  return jsonData(transaction, { status: 201 });
}
