import { jsonData } from "@/lib/api-response";
import { listPointBalances } from "@/server/points";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { familyId } = await context.params;
  const balances = await listPointBalances({ familyId });

  return jsonData(balances);
}
