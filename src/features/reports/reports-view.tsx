"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdPlacement } from "@/components/billing/ad-placement";

type ApiEnvelope<T> = { data: T };

type FamiliesResponse = {
  families: Array<{ id: string; name: string }>;
};

type ReportsSummary = {
  monthlyExpenseByCategory: Array<{ category: string; amount: number }>;
  accountBalances: Array<{ id: string; name: string; balance: number }>;
  fundBalances: Array<{ id: string; name: string; balance: number }>;
};

type BudgetUsage = {
  budget: {
    id: string;
    name: string;
    category?: string;
    amount: number;
    periodType: "monthly" | "custom";
  };
  spent: number;
  remaining: number;
  exceeded: boolean;
};

type PlanStatus = {
  plan: "free" | "paid";
  limits: {
    reportsMonths: number | null;
    canExportReports: boolean;
    canUseAdvancedReports: boolean;
    hasAds: boolean;
  };
  statuses: {
    reportExport: "ok" | "warning" | "blocked";
  };
};

async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok) {
    throw new Error("Request failed.");
  }

  return body.data;
}

export function ReportsView() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [budgets, setBudgets] = useState<BudgetUsage[]>([]);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const families = await fetchData<FamiliesResponse>("/api/v1/families");
        const family = families.families[0];
        if (!family) return;

        const [summaryData, budgetData, planData] = await Promise.all([
          fetchData<ReportsSummary>(`/api/v1/families/${family.id}/reports/summary`),
          fetchData<BudgetUsage[]>(`/api/v1/families/${family.id}/budgets`),
          fetchData<PlanStatus>(`/api/v1/families/${family.id}/plan/limits`)
        ]);

        if (!cancelled) {
          setFamilyId(family.id);
          setSummary(summaryData);
          setBudgets(budgetData);
          setPlan(planData);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load reports.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function exportReport(format: "csv" | "xls") {
    if (!familyId) return;

    setMessage("");
    const response = await fetch(
      `/api/v1/families/${familyId}/reports/export?format=${format}`
    );

    if (response.status === 402) {
      setMessage("Report export is available on the paid plan.");
      return;
    }

    if (!response.ok) {
      setMessage("Unable to export this report.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `family-os-report.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function createBudget(formData: FormData) {
    if (!familyId) return;

    setMessage("");
    const response = await fetch(`/api/v1/families/${familyId}/budgets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        targetType: "personal_category",
        category: formData.get("category"),
        amount: Number(formData.get("amount")),
        periodType: "monthly"
      })
    });
    const body = (await response.json()) as ApiEnvelope<BudgetUsage>;

    if (!response.ok) {
      setMessage("Unable to create this budget.");
      return;
    }

    setBudgets((current) => [body.data, ...current]);
  }

  const monthlyExpense =
    summary?.monthlyExpenseByCategory.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const accountTotal =
    summary?.accountBalances.reduce((sum, item) => sum + item.balance, 0) ?? 0;
  const fundTotal = summary?.fundBalances.reduce((sum, item) => sum + item.balance, 0) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Household Reports"
        description="View monthly expense categories, personal account balances, and shared fund balances from live API data."
        action={
          <div className="topbar-action">
            <button type="button" onClick={() => exportReport("csv")} disabled={!familyId}>
              Export CSV
            </button>
            <button type="button" onClick={() => exportReport("xls")} disabled={!familyId}>
              Export Excel
            </button>
          </div>
        }
      />

      {message ? <p className="error-text">{message}</p> : null}

      <div className="summary-grid">
        <article>
          <p>Monthly expenses</p>
          <strong>{formatCurrency(monthlyExpense)}</strong>
        </article>
        <article>
          <p>Personal accounts</p>
          <strong>{formatCurrency(accountTotal)}</strong>
        </article>
        <article>
          <p>Shared funds</p>
          <strong>{formatCurrency(fundTotal)}</strong>
        </article>
        <article>
          <p>Plan</p>
          <strong>{plan ? plan.plan : loading ? "Loading" : "Unknown"}</strong>
        </article>
      </div>

      <div className="content-grid">
        <section className="panel">
          <h2>Expense Categories</h2>
          <div className="module-list">
            {(summary?.monthlyExpenseByCategory ?? []).map((item) => (
              <div className="module-row" key={item.category}>
                <span>{item.category}</span>
                <strong>{formatCurrency(item.amount)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Plan Guard</h2>
          <div className="module-list">
            <div className="module-row">
              <span>Report range</span>
              <small>
                {plan?.limits.reportsMonths
                  ? `Last ${plan.limits.reportsMonths} months`
                  : "Unlimited"}
              </small>
            </div>
            <div className="module-row">
              <span>Report export</span>
              <small>{plan?.limits.canExportReports ? "Enabled" : "Paid plan only"}</small>
            </div>
            <div className="module-row">
              <span>Ads</span>
              <small>{plan?.limits.hasAds ? "Visible on free plan" : "Hidden"}</small>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Budgets</h2>
          <form action={createBudget} className="module-form">
            <input name="name" placeholder="Budget name" required />
            <input name="category" placeholder="Category, e.g. Food" required />
            <input name="amount" inputMode="decimal" placeholder="Amount" required />
            <button type="submit" disabled={!familyId}>
              Add Budget
            </button>
          </form>
          <div className="module-list">
            {budgets.map((item) => (
              <div className="module-row" key={item.budget.id}>
                <span>
                  {item.budget.name}
                  {item.budget.category ? ` (${item.budget.category})` : ""}
                </span>
                <small>
                  spent {formatCurrency(item.spent)} / budget{" "}
                  {formatCurrency(item.budget.amount)} / remaining{" "}
                  <strong className={item.exceeded ? "danger-inline" : undefined}>
                    {formatCurrency(item.remaining)}
                  </strong>
                </small>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Account Balances</h2>
          <div className="module-list">
            {(summary?.accountBalances ?? []).map((item) => (
              <div className="module-row" key={item.id}>
                <span>{item.name}</span>
                <strong>{formatCurrency(item.balance)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Fund Balances</h2>
          <div className="module-list">
            {(summary?.fundBalances ?? []).map((item) => (
              <div className="module-row" key={item.id}>
                <span>{item.name}</span>
                <strong>{formatCurrency(item.balance)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <AdPlacement placement="reports-bottom" />
    </>
  );
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString()}`;
}
