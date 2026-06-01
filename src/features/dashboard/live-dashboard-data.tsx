"use client";

import { FormEvent, useEffect, useState } from "react";

type ApiEnvelope<T> = {
  data: T;
};

type Family = {
  id: string;
  name: string;
};

type FamiliesResponse = {
  families: Family[];
};

type Task = {
  id: string;
  title: string;
  approvalMode: "auto" | "review";
  maxPoints: number;
};

type PointBalance = {
  balance: number;
};

type Wish = {
  id: string;
  title: string;
  status: string;
  agreedPoints?: number;
};

type DashboardState =
  | { status: "loading" }
  | { status: "auth" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      family: Family;
      tasks: Task[];
      pointBalance: PointBalance;
      wishes: Wish[];
    };

type AuthMode = "login" | "register";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (response.status === 401) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  return payload.data;
}

export function LiveDashboardData() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const familiesResponse = await fetchJson<FamiliesResponse>("/api/v1/families");
        const family = familiesResponse.families[0];

        if (!family) {
          throw new Error("目前帳號還沒有加入任何家庭。");
        }

        const [tasks, pointBalance, wishes] = await Promise.all([
          fetchJson<Task[]>(`/api/v1/families/${family.id}/tasks`),
          fetchJson<PointBalance>(`/api/v1/families/${family.id}/points/me`),
          fetchJson<Wish[]>(`/api/v1/families/${family.id}/wishes`)
        ]);

        if (!cancelled) {
          setState({ status: "ready", family, tasks, pointBalance, wishes });
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "資料載入失敗。";
          setState(message === "AUTH_REQUIRED" ? { status: "auth" } : { status: "error", message });
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (state.status === "loading") {
    return (
      <section className="panel">
        <h2>API 串接狀態</h2>
        <p className="page-description">正在載入家庭、任務、點數與願望資料。</p>
      </section>
    );
  }

  if (state.status === "auth") {
    return <AuthPanel onAuthenticated={() => setRefreshKey((value) => value + 1)} />;
  }

  if (state.status === "error") {
    return (
      <section className="panel">
        <h2>API 串接狀態</h2>
        <p className="error-text">{state.message}</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>API 串接狀態</h2>
      <div className="module-list">
        <div className="module-row">
          <span>家庭</span>
          <small>{state.family.name}</small>
        </div>
        <div className="module-row">
          <span>任務</span>
          <small>{state.tasks.length} 筆任務已由 `/tasks` API 載入</small>
        </div>
        <div className="module-row">
          <span>點數</span>
          <small>{state.pointBalance.balance} 點已由 `/points/me` API 載入</small>
        </div>
        <div className="module-row">
          <span>願望</span>
          <small>{state.wishes.length} 筆願望已由 `/wishes` API 載入</small>
        </div>
      </div>
    </section>
  );
}

function AuthPanel({ onAuthenticated }: { onAuthenticated: () => void }) {
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
      const body =
        mode === "register"
          ? { displayName, email, password }
          : { email, password };

      await fetchJson(`/api/v1/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      onAuthenticated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登入失敗。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <h2>API 串接狀態</h2>
      <p className="page-description">請先登入或建立帳號，系統會用 cookie session 存取家庭資料。</p>
      <div className="auth-toggle" role="tablist" aria-label="Auth mode">
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
    </section>
  );
}
