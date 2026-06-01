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
      setError(loadError instanceof Error ? loadError.message : "Admin data could not load.");
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
        body: JSON.stringify({ reason: "MVP admin action" })
      });
      await loadAdminData();
    } catch (banError) {
      setError(banError instanceof Error ? banError.message : "User update failed.");
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
      setError(adError instanceof Error ? adError.message : "Ad placement update failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="muted">Admin</p>
          <h1>Monitoring</h1>
          <p className="page-description">
            Basic operator dashboard for account health, families, ads and audit history.
          </p>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </header>

      <section className="summary-grid admin-summary" aria-label="Admin metrics">
        <MetricCard label="Users" value={data.metrics?.users.total ?? 0} />
        <MetricCard label="Families" value={data.metrics?.families.total ?? 0} />
        <MetricCard label="Banned" value={data.metrics?.users.banned ?? 0} tone="danger" />
        <MetricCard label="Activity" value={activityTotal} />
      </section>

      <section className="content-grid admin-grid">
        <div className="panel">
          <h2>Users</h2>
          <div className="admin-table" role="table" aria-label="Admin users">
            <div className="admin-table-row admin-table-head" role="row">
              <span>Name</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {data.users.map((user) => (
              <div className="admin-table-row" role="row" key={user.id}>
                <span>
                  <strong>{user.name}</strong>
                  <small>{user.email ?? user.id}</small>
                </span>
                <span>
                  {user.isAdmin ? "Admin" : user.isChildAccount ? "Child" : "Member"}
                  {user.bannedAt ? <em> Banned</em> : null}
                </span>
                <button
                  className={user.bannedAt ? "secondary-button" : "danger-button"}
                  disabled={busyId === user.id || user.isAdmin}
                  onClick={() => setBan(user, !user.bannedAt)}
                >
                  {user.bannedAt ? "Unban" : "Ban"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Families</h2>
          <div className="module-list">
            {data.families.map((family) => (
              <div className="module-row" key={family.id}>
                <span>{family.name}</span>
                <small>
                  {family.plan} plan - {family.memberCount} members
                </small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="content-grid admin-grid">
        <div className="panel">
          <h2>Ads</h2>
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
                  {ad.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Audit Log</h2>
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
              <p className="muted">No admin audit entries yet.</p>
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
    throw new Error(payload.error?.message ?? "Request failed.");
  }

  return payload.data as T;
}
