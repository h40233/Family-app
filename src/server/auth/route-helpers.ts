import { jsonError } from "@/lib/api-response";
import { PlanLimitError } from "@/server/plans";
import { PermissionDeniedError, UnauthorizedError } from "./errors";

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function apiRouteError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return jsonError("UNAUTHORIZED", error.message, 401);
  }

  if (error instanceof PermissionDeniedError) {
    return jsonError("PERMISSION_DENIED", error.message, 403);
  }

  if (error instanceof PlanLimitError) {
    return jsonError("PLAN_LIMIT_EXCEEDED", error.message, 402);
  }

  return jsonError("BAD_REQUEST", "The request could not be processed.", 400, {
    message: error instanceof Error ? error.message : "Unknown error"
  });
}
