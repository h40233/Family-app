import { jsonData } from "@/lib/api-response";
import { apiRouteError, requireAuth } from "@/server/auth";
import {
  getPersonalSharingSetting,
  updatePersonalSharingSetting,
  type PersonalSharingConfig,
  type PersonalSharingLevel
} from "@/server/money";

type RouteContext = {
  params: Promise<{ familyId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;

    return jsonData(await getPersonalSharingSetting({ userId: user.id, familyId }));
  } catch (error) {
    return apiRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireAuth(request);
    const { familyId } = await context.params;
    const body = await request.json().catch(() => ({}));

    return jsonData(
      await updatePersonalSharingSetting({
        userId: user.id,
        familyId,
        sharingLevel: parseSharingLevel(body.sharingLevel),
        config: parseSharingConfig(body.config)
      })
    );
  } catch (error) {
    return apiRouteError(error);
  }
}

function parseSharingLevel(value: unknown): PersonalSharingLevel {
  if (
    value === "none" ||
    value === "balance_only" ||
    value === "category_summary" ||
    value === "partial_transactions" ||
    value === "full"
  ) {
    return value;
  }

  throw new Error("Sharing level is invalid.");
}

function parseSharingConfig(value: unknown): PersonalSharingConfig | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as PersonalSharingConfig;
}
