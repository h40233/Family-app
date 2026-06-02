"use client";

import { useEffect, useState } from "react";
import { AuthForm } from "@/components/auth/auth-form";

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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (response.status === 401) {
    throw new Error("AUTH_REQUIRED");
  }

  if (!response.ok) {
    throw new Error(`API 請求失敗：${response.status}`);
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
    return (
      <section className="panel">
        <h2>API 串接狀態</h2>
        <p className="page-description">請先登入，系統會用 cookie session 存取家庭資料。</p>
        <AuthForm onAuthenticated={() => setRefreshKey((value) => value + 1)} />
      </section>
    );
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
