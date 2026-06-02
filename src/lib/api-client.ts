export type ApiEnvelope<T> = { data?: T; meta?: Record<string, unknown> };

export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & ApiErrorPayload;

  if (!response.ok || payload.error) {
    throw new ApiClientError(
      payload.error?.message ?? "請求失敗。",
      payload.error?.code ?? "REQUEST_FAILED",
      response.status,
      payload.error?.details
    );
  }

  return payload.data as T;
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.code === "UNAUTHORIZED") return "請先登入。";
    if (error.status === 403 || error.code === "PERMISSION_DENIED") return "你沒有執行此操作的權限。";
    return error.message;
  }

  if (error instanceof Error) return error.message;

  return "發生未知錯誤，請稍後再試。";
}
