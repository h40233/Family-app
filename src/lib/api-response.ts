export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "PLAN_LIMIT_EXCEEDED"
  | "CONFLICT";

export function jsonData<T>(data: T, init?: ResponseInit) {
  return Response.json({ data, meta: {} }, init);
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details: Record<string, unknown> = {}
) {
  return Response.json({ error: { code, message, details } }, { status });
}
