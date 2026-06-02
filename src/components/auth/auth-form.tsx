"use client";

import { FormEvent, useState } from "react";

type ApiEnvelope<T> = {
  data?: T;
  error?: { message: string };
};

type AuthMode = "login" | "register";

type AuthFormProps = {
  onAuthenticated?: () => void;
};

async function postAuth<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `請求失敗：${response.status}`);
  }

  return payload.data as T;
}

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("家庭管理者");
  const [email, setEmail] = useState("dev@family-os.local");
  const [password, setPassword] = useState("pass1234");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const body = mode === "register" ? { displayName, email, password } : { email, password };
      await postAuth(`/api/v1/auth/${mode}`, body);
      onAuthenticated?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登入失敗。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="auth-toggle" role="tablist" aria-label="登入模式">
        <button
          type="button"
          className={mode === "login" ? undefined : "secondary-button"}
          onClick={() => setMode("login")}
        >
          登入
        </button>
        <button
          type="button"
          className={mode === "register" ? undefined : "secondary-button"}
          onClick={() => setMode("register")}
        >
          建立帳號
        </button>
      </div>

      <form className="auth-form" onSubmit={submit}>
        {mode === "register" ? (
          <label>
            顯示名稱
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>
        ) : null}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          密碼
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "處理中" : mode === "register" ? "建立並登入" : "登入"}
        </button>
      </form>

      {message ? <p className="error-text">{message}</p> : null}
    </>
  );
}
