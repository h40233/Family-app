import { jsonData } from "@/lib/api-response";
import { listPointLedger } from "@/server/points";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { familyId } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit");

  const ledger = await listPointLedger({
    familyId,
    userId: searchParams.get("userId") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: limit ? Number(limit) : undefined
  });

  return jsonData(ledger.entries, { headers: ledger.nextCursor ? { "x-next-cursor": ledger.nextCursor } : undefined });
}
