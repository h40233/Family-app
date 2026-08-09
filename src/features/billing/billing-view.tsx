"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ThemePicker } from "@/components/billing/theme-picker";

type ApiEnvelope<T> = { data: T };
type FamiliesResponse = { families: Array<{ id: string; name: string }> };
type PlanStatus = {
  plan: "free" | "paid";
  limits: {
    maxMembers: number | null;
    maxTasks: number | null;
    maxWishes: number | null;
    reportsMonths: number | null;
    canExportReports: boolean;
    canUseAdvancedReports: boolean;
    canUseMultipleThemes: boolean;
    hasAds: boolean;
  };
  usage: { members: number; tasks: number; wishes: number };
};

async function fetchData<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error("請求失敗。");
  return body.data;
}

export function BillingView() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const families = await fetchData<FamiliesResponse>("/api/v1/families");
        const family = families.families[0];
        if (!family) return;
        const status = await fetchData<PlanStatus>(`/api/v1/families/${family.id}/plan/limits`);
        if (!cancelled) {
          setFamilyId(family.id);
          setPlan(status);
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "無法載入方案。");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function upgrade() {
    if (!familyId) return;
    setMessage("");
    try {
      await fetchData(`/api/v1/families/${familyId}/billing/checkout`, { method: "POST" });
      const status = await fetchData<PlanStatus>(`/api/v1/families/${familyId}/plan/limits`);
      setPlan(status);
      setMessage("此 MVP 工作階段已升級為付費方案。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "無法升級方案。");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="方案"
        title="方案與限制"
        description="免費家庭可使用核心功能；付費方案可解鎖匯出、進階報表、多主題、更多成員與移除廣告。"
        action={
          <button type="button" onClick={upgrade} disabled={!familyId || plan?.plan === "paid"}>
            升級
          </button>
        }
      />

      {message ? <p className="error-text">{message}</p> : null}

      <div className="summary-grid">
        <LimitCard label="目前方案" value={plan ? planLabel(plan.plan) : "載入中"} />
        <LimitCard label="成員" value={formatLimit(plan?.usage.members, plan?.limits.maxMembers)} />
        <LimitCard label="任務" value={formatLimit(plan?.usage.tasks, plan?.limits.maxTasks)} />
        <LimitCard label="願望" value={formatLimit(plan?.usage.wishes, plan?.limits.maxWishes)} />
      </div>

      <section className="panel">
        <h2>付費功能</h2>
        <div className="module-list">
          <FeatureRow label="CSV / Excel 報表匯出" enabled={Boolean(plan?.limits.canExportReports)} />
          <FeatureRow label="進階報表" enabled={Boolean(plan?.limits.canUseAdvancedReports)} />
          <FeatureRow label="多種主題" enabled={Boolean(plan?.limits.canUseMultipleThemes)} />
          <FeatureRow label="移除廣告" enabled={plan ? !plan.limits.hasAds : false} />
          <div className="module-row">
            <span>報表歷史</span>
            <small>{plan?.limits.reportsMonths ? `近 ${plan.limits.reportsMonths} 個月` : "不限"}</small>
          </div>
        </div>
      </section>

      <ThemePicker familyId={familyId} canUseMultipleThemes={Boolean(plan?.limits.canUseMultipleThemes)} />
    </>
  );
}

function LimitCard({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="module-row">
      <span>{label}</span>
      <small>{enabled ? "已啟用" : "付費方案"}</small>
    </div>
  );
}

function formatLimit(value?: number, limit?: number | null) {
  if (value === undefined) return "載入中";
  return limit === null || limit === undefined ? `${value} / 不限` : `${value} / ${limit}`;
}

function planLabel(plan: PlanStatus["plan"]) {
  return plan === "paid" ? "付費" : "免費";
}
