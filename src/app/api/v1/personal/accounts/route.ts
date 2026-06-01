import { jsonData } from "@/lib/api-response";
import { requireAuth } from "@/server/auth";
import { createPersonalAccount, listPersonalAccounts } from "@/server/money";

export async function GET(request: Request) {
  const user = await requireAuth(request);
  const accounts = await listPersonalAccounts(user.id);

  return jsonData(accounts);
}

export async function POST(request: Request) {
  const user = await requireAuth(request);
  const body = await request.json().catch(() => ({}));

  const account = await createPersonalAccount({
    userId: user.id,
    name: String(body.name ?? ""),
    type: parseAccountType(body.type)
  });

  return jsonData(account, { status: 201 });
}

function parseAccountType(value: unknown) {
  if (value === "cash" || value === "bank" || value === "e_wallet" || value === "other") {
    return value;
  }

  return "other";
}
