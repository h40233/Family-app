"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ThemePicker } from "@/components/billing/theme-picker";

type ApiEnvelope<T> = { data: T };

type FamiliesResponse = {
  families: Array<{ id: string; name: string }>;
};

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
  usage: {
    members: number;
    tasks: number;
    wishes: number;
  };
};

async function fetchData<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new Error("Request failed.");
  }

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
        const status = await fetchData<PlanStatus>(
          `/api/v1/families/${family.id}/plan/limits`
        );
        if (!cancelled) {
          setFamilyId(family.id);
          setPlan(status);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load plan.");
        }
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
      await fetchData(`/api/v1/families/${familyId}/billing/checkout`, {
        method: "POST"
      });
      const status = await fetchData<PlanStatus>(
        `/api/v1/families/${familyId}/plan/limits`
      );
      setPlan(status);
      setMessage("Plan upgraded to paid for this MVP session.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upgrade plan.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Plan and Limits"
        description="Free families can try the core household workflow with limits. Paid families unlock export, advanced reports, more storage, more members, and no ads."
        action={
          <button type="button" onClick={upgrade} disabled={!familyId || plan?.plan === "paid"}>
            Upgrade
          </button>
        }
      />

      {message ? <p className="error-text">{message}</p> : null}

      <div className="summary-grid">
        <LimitCard label="Current plan" value={plan?.plan ?? "Loading"} />
        <LimitCard label="Members" value={formatLimit(plan?.usage.members, plan?.limits.maxMembers)} />
        <LimitCard label="Tasks" value={formatLimit(plan?.usage.tasks, plan?.limits.maxTasks)} />
        <LimitCard label="Wishes" value={formatLimit(plan?.usage.wishes, plan?.limits.maxWishes)} />
      </div>

      <section className="panel">
        <h2>Paid Features</h2>
        <div className="module-list">
          <FeatureRow
            label="CSV report export"
            enabled={Boolean(plan?.limits.canExportReports)}
          />
          <FeatureRow
            label="Advanced reports"
            enabled={Boolean(plan?.limits.canUseAdvancedReports)}
          />
          <FeatureRow
            label="Multiple themes"
            enabled={Boolean(plan?.limits.canUseMultipleThemes)}
          />
          <FeatureRow label="Ads removed" enabled={plan ? !plan.limits.hasAds : false} />
          <div className="module-row">
            <span>Report history</span>
            <small>
              {plan?.limits.reportsMonths
                ? `Last ${plan.limits.reportsMonths} months`
                : "Unlimited"}
            </small>
          </div>
        </div>
      </section>

      <ThemePicker canUseMultipleThemes={Boolean(plan?.limits.canUseMultipleThemes)} />
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
      <small>{enabled ? "Enabled" : "Paid plan"}</small>
    </div>
  );
}

function formatLimit(value?: number, limit?: number | null) {
  if (value === undefined) return "Loading";
  return limit === null || limit === undefined ? `${value} / Unlimited` : `${value} / ${limit}`;
}
