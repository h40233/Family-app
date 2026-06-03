import { jsonData } from "@/lib/api-response";
import { requireAuth } from "@/server/auth";
import { syncOfflinePersonalTransactions } from "@/server/money";

type OfflineTransactionBody = {
  accountId?: unknown;
  clientMutationId?: unknown;
  type?: unknown;
  category?: unknown;
  categoryId?: unknown;
  amount?: unknown;
  note?: unknown;
  occurredAt?: unknown;
};

export async function POST(request: Request) {
  const user = await requireAuth(request);
  const body = await request.json().catch(() => ({}));
  const transactions: OfflineTransactionBody[] = Array.isArray(body.transactions)
    ? body.transactions
    : [];

  const result = await syncOfflinePersonalTransactions({
    userId: user.id,
    transactions: transactions.map((transaction) => ({
      accountId: String(transaction.accountId ?? ""),
      clientMutationId:
        typeof transaction.clientMutationId === "string"
          ? transaction.clientMutationId
          : undefined,
      type: transaction.type === "income" ? "income" : "expense",
      categoryId: typeof transaction.categoryId === "string" ? transaction.categoryId : undefined,
      category: typeof transaction.category === "string" ? transaction.category : undefined,
      amount: Number(transaction.amount ?? 0),
      note: typeof transaction.note === "string" ? transaction.note : undefined,
      occurredAt:
        typeof transaction.occurredAt === "string" ? transaction.occurredAt : undefined
    }))
  });

  return jsonData(result);
}
