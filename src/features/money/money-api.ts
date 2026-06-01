export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown> };

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
  const payload = (await response.json().catch(() => ({}))) as Partial<
    ApiEnvelope<T> & ApiErrorPayload
  >;

  if (!response.ok || payload.error) {
    throw new ApiClientError(
      payload.error?.message ?? "Request failed.",
      payload.error?.code ?? "REQUEST_FAILED",
      response.status,
      payload.error?.details
    );
  }

  return payload.data as T;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 403 || error.code === "PERMISSION_DENIED") {
      return "你目前沒有權限執行這個操作。";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "操作失敗，請稍後再試。";
}
