"use client";

import { useEffect, useMemo, useState } from "react";

type Metrics = {
  users: { total: number; children: number; admins: number; banned: number };
  families: { total: number; paid: number; free: number };
  activity: {
    notifications: number;
    tasks: number;
    wishes: number;
    personalTransactions: number;
    fundTransactions: number;
  };
};

type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  isChildAccount: boolean;
  isAdmin: boolean;
  bannedAt: string | null;
};

type AdminFamily = {
  id: string;
  name: string;
  plan: string;
  memberCount: number;
};

type AdPlacement = {
  id: string;
  name: string;
  location: string;
  enabled: boolean;
  label: string;
};

type AuditLog = {
  id: string;
  action: string;
  resourceType: string;
  createdAt: string;
};

type AdminData = {
  metrics: Metrics | null;
  users: AdminUser[];
  families: AdminFamily[];
  ads: AdPlacement[];
  auditLogs: AuditLog[];
};

const emptyData: AdminData = {
  metrics: null,
  users: [],
  families: [],
  ads: [],
  auditLogs: []
};

export function AdminDashboard() {
  const [data, setData] = useState<AdminData>(emptyData);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadAdminData() {
    setError(null);

    try {
      const [metrics, users, families, ads, auditLogs] = await Promise.all([
        fetchJson<{ metrics: Metrics }>("/api/v1/admin/metrics"),
        fetchJson<{ users: AdminUser[] }>("/api/v1/admin/users"),
        fetchJson<{ families: AdminFamily[] }>("/api/v1/admin/families"),
        fetchJson<{ ads: AdPlacement[] }>("/api/v1/admin/ads"),
        fetchJson<{ auditLogs: AuditLog[] }>("/api/v1/admin/audit-logs")
      ]);

      setData({
        metrics: metrics.metrics,
        users: users.users,
        families: families.families,
        ads: ads.ads,
        auditLogs: auditLogs.auditLogs
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "無法載入後台資料。");
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  const activityTotal = useMemo(() => {
    const activity = data.metrics?.activity;
    if (!activity) return 0;

    return (
      activity.notifications +
      activity.tasks +
      activity.wishes +
      activity.personalTransactions +
      activity.fundTransactions
    );
  }, [data.metrics]);

  async function setBan(user: AdminUser, banned: boolean) {
    setBusyId(user.id);
    setError(null);

    try {
      await fetchJson(`/api/v1/admin/users/${user.id}/${banned ? "ban" : "unban"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "MVP 後台操作" })
      });
      await loadAdminData();
    } catch (banError) {
      setError(banError instanceof Error ? banError.message : "使用者更新失敗。");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAd(ad: AdPlacement) {
    setBusyId(ad.id);
    setError(null);

    try {
      await fetchJson("/api/v1/admin/ads", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placementId: ad.id,
          enabled: !ad.enabled,
          label: ad.label
        })
      });
      await loadAdminData();
    } catch (adError) {
      setError(adError instanceof Error ? adError.message : "廣告版位更新失敗。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="muted">管理後台</p>
          <h1>營運監控</h1>
          <p className="page-description">
            查看帳號狀態、家庭資料、廣告版位與稽核紀錄。
          </p>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </header>

      <section className="summary-grid admin-summary" aria-label="後台指標">
        <MetricCard label="使用者" value={data.metrics?.users.total ?? 0} />
        <MetricCard label="家庭" value={data.metrics?.families.total ?? 0} />
        <MetricCard label="停權" value={data.metrics?.users.banned ?? 0} tone="danger" />
        <MetricCard label="活動" value={activityTotal} />
      </section>

      <section className="content-grid admin-grid">
        <div className="panel">
          <h2>使用者</h2>
          <div className="admin-table" role="table" aria-label="後台使用者">
            <div className="admin-table-row admin-table-head" role="row">
              <span>名稱</span>
              <span>狀態</span>
              <span>操作</span>
            </div>
            {data.users.map((user) => (
              <div className="admin-table-row" role="row" key={user.id}>
                <span>
                  <strong>{user.name}</strong>
                  <small>{user.email ?? user.id}</small>
                </span>
                <span>
                  {user.isAdmin ? "管理員" : user.isChildAccount ? "小孩帳號" : "成員"}
                  {user.bannedAt ? <em> 已停權</em> : null}
                </span>
                <button
                  className={user.bannedAt ? "secondary-button" : "danger-button"}
                  disabled={busyId === user.id || user.isAdmin}
                  onClick={() => setBan(user, !user.bannedAt)}
                >
                  {user.bannedAt ? "解除停權" : "停權"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>家庭</h2>
          <div className="module-list">
            {data.families.map((family) => (
              <div className="module-row" key={family.id}>
                <span>{family.name}</span>
                <small>
                  {family.plan === "paid" ? "付費" : "免費"}方案 - {family.memberCount} 位成員
                </small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="content-grid admin-grid">
        <div className="panel">
          <h2>廣告</h2>
          <div className="module-list">
            {data.ads.map((ad) => (
              <div className="module-row" key={ad.id}>
                <span>
                  {ad.name}
                  <small>{ad.location}</small>
                </span>
                <button
                  className={ad.enabled ? "secondary-button" : undefined}
                  disabled={busyId === ad.id}
                  onClick={() => toggleAd(ad)}
                >
                  {ad.enabled ? "停用" : "啟用"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>稽核紀錄</h2>
          <div className="module-list">
            {data.auditLogs.length ? (
              data.auditLogs.map((log) => (
                <div className="module-row audit-row" key={log.id}>
                  <span>{log.action}</span>
                  <small>
                    {log.resourceType} - {new Date(log.createdAt).toLocaleString()}
                  </small>
                </div>
              ))
            ) : (
              <p className="muted">目前沒有後台稽核紀錄。</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function MetricCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <article>
      <p>{label}</p>
      <strong className={tone === "danger" ? "danger-inline" : undefined}>{value}</strong>
    </article>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "請求失敗。");
  }

  return payload.data as T;
}
