import { jsonData } from "@/lib/api-response";
import { requireAuth } from "@/server/auth";
import { createPersonalCategory, listPersonalCategories } from "@/server/money";

export async function GET(request: Request) {
  const user = await requireAuth(request);
  const categories = await listPersonalCategories(user.id);

  return jsonData(categories);
}

export async function POST(request: Request) {
  const user = await requireAuth(request);
  const body = await request.json().catch(() => ({}));
  const category = await createPersonalCategory({
    userId: user.id,
    type: body.type === "income" ? "income" : "expense",
    parentId: typeof body.parentId === "string" && body.parentId ? body.parentId : undefined,
    name: String(body.name ?? "")
  });

  return jsonData(category, { status: 201 });
}
