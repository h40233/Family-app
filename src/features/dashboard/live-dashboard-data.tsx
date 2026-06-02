"use client";

import { useEffect, useMemo, useState } from "react";
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
  status: "open" | "completed" | "cancelled";
  dueAt?: string;
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

type ReportsSummary = {
  monthlyExpenseByCategory: Array<{ category: string; amount: number }>;
  accountBalances: Array<{ id: string; name: string; balance: number }>;
  fundBalances: Array<{ id: string; name: string; balance: number }>;
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
      reports: ReportsSummary;
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

        const [tasks, pointBalance, wishes, reports] = await Promise.all([
          fetchJson<Task[]>(`/api/v1/families/${family.id}/tasks`),
          fetchJson<PointBalance>(`/api/v1/families/${family.id}/points/me`),
          fetchJson<Wish[]>(`/api/v1/families/${family.id}/wishes`),
          fetchJson<ReportsSummary>(`/api/v1/families/${family.id}/reports/summary`)
        ]);

        if (!cancelled) {
          setState({ status: "ready", family, tasks, pointBalance, wishes, reports });
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
        <h2>即時資料</h2>
        <p className="page-description">正在從後端載入家庭總覽。</p>
      </section>
    );
  }

  if (state.status === "auth") {
    return (
      <section className="panel">
        <h2>需要登入</h2>
        <p className="page-description">登入後才會顯示你的家庭資料。</p>
        <AuthForm onAuthenticated={() => setRefreshKey((value) => value + 1)} />
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="panel">
        <h2>即時資料</h2>
        <p className="error-text">{state.message}</p>
      </section>
    );
  }

  return <ReadyDashboard state={state} />;
}

function ReadyDashboard({
  state
}: {
  state: Extract<DashboardState, { status: "ready" }>;
}) {
  const accountTotal = useMemo(
    () => state.reports.accountBalances.reduce((sum, account) => sum + account.balance, 0),
    [state.reports.accountBalances]
  );
  const fundTotal = useMemo(
    () => state.reports.fundBalances.reduce((sum, fund) => sum + fund.balance, 0),
    [state.reports.fundBalances]
  );
  const openTasks = state.tasks.filter((task) => task.status === "open");
  const activeWish =
    state.wishes.find((wish) => wish.status === "active" && wish.agreedPoints) ??
    state.wishes[0];
  const wishTarget = activeWish?.agreedPoints ?? 0;
  const wishProgress = wishTarget
    ? Math.min(100, Math.round((state.pointBalance.balance / wishTarget) * 100))
    : 0;

  return (
    <>
      <div className="summary-grid">
        <article>
          <p>個人帳戶總餘額</p>
          <strong>{formatCurrency(accountTotal)}</strong>
        </article>
        <article>
          <p>共用基金餘額</p>
          <strong>{formatCurrency(fundTotal)}</strong>
        </article>
        <article>
          <p>待完成任務</p>
          <strong>{openTasks.length}</strong>
        </article>
        <article>
          <p>我的點數</p>
          <strong>{state.pointBalance.balance}</strong>
        </article>
      </div>

      <div className="content-grid">
        <section className="panel">
          <h2>任務預覽</h2>
          <ul className="task-list">
            {state.tasks.slice(0, 5).map((task) => (
              <li key={task.id}>
                <span>{task.title}</span>
                <small>
                  {task.maxPoints} 點 / {task.approvalMode === "auto" ? "自動發分" : "需要審核"}
                  {task.dueAt ? ` / ${new Date(task.dueAt).toLocaleString()}` : ""}
                </small>
              </li>
            ))}
            {state.tasks.length === 0 ? <li className="muted">目前沒有任務。</li> : null}
          </ul>
        </section>

        <section className="panel">
          <h2>願望進度</h2>
          {activeWish ? (
            <div className="wish-card">
              <span>{activeWish.title}</span>
              <strong>
                {state.pointBalance.balance} / {wishTarget || "未定價"}
              </strong>
              <div className="progress" aria-label={`願望進度 ${wishProgress}%`}>
                <span style={{ width: `${wishProgress}%` }} />
              </div>
            </div>
          ) : (
            <p className="muted">目前沒有願望。</p>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>API 串接狀態</h2>
        <div className="module-list">
          <div className="module-row">
            <span>家庭</span>
            <small>{state.family.name}</small>
          </div>
          <div className="module-row">
            <span>資料來源</span>
            <small>家庭、任務、點數、願望、報表皆由後端 API 載入</small>
          </div>
        </div>
      </section>
    </>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0
  }).format(value);
}
