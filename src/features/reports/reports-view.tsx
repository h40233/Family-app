"use client";

import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { AdPlacement } from "@/components/billing/ad-placement";

type ApiEnvelope<T> = { data: T };
type FamiliesResponse = { families: Array<{ id: string; name: string }> };
type ReportsSummary = {
  monthlyExpenseByCategory: Array<{ category: string; amount: number }>;
  accountBalances: Array<{ id: string; name: string; balance: number }>;
  fundBalances: Array<{ id: string; name: string; balance: number }>;
};
type BudgetUsage = {
  budget: { id: string; name: string; category?: string; amount: number; periodType: "monthly" | "custom" };
  spent: number;
  remaining: number;
  exceeded: boolean;
};
type PlanStatus = {
  plan: "free" | "paid";
  limits: { reportsMonths: number | null; canExportReports: boolean; canUseAdvancedReports: boolean; hasAds: boolean };
};

async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error("請求失敗。");
  return body.data;
}

export function ReportsView() {
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [budgets, setBudgets] = useState<BudgetUsage[]>([]);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingBudgetName, setEditingBudgetName] = useState("");
  const [editingBudgetCategory, setEditingBudgetCategory] = useState("");
  const [editingBudgetAmount, setEditingBudgetAmount] = useState("");

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
        if (!cancelled) setMessage(error instanceof Error ? error.message : "無法載入報表。");
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
    const response = await fetch(`/api/v1/families/${familyId}/reports/export?format=${format}`);
    if (response.status === 402) {
      setMessage("報表匯出為付費方案功能。");
      return;
    }
    if (!response.ok) {
      setMessage("無法匯出此報表。");
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
      setMessage("無法建立此預算。");
      return;
    }
    setBudgets((current) => [body.data, ...current]);
  }

  function startBudgetEdit(item: BudgetUsage) {
    setEditingBudgetId(item.budget.id);
    setEditingBudgetName(item.budget.name);
    setEditingBudgetCategory(item.budget.category ?? "");
    setEditingBudgetAmount(String(item.budget.amount));
  }

  async function saveBudgetEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!familyId || !editingBudgetId) return;
    setMessage("");
    const response = await fetch(`/api/v1/families/${familyId}/budgets/${editingBudgetId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: editingBudgetName,
        category: editingBudgetCategory,
        amount: Number(editingBudgetAmount)
      })
    });
    const body = (await response.json()) as ApiEnvelope<BudgetUsage>;
    if (!response.ok) {
      setMessage("無法更新預算。");
      return;
    }
    setBudgets((current) =>
      current.map((item) => (item.budget.id === body.data.budget.id ? body.data : item))
    );
    setEditingBudgetId(null);
  }

  async function removeBudget(budgetId: string) {
    if (!familyId) return;
    setMessage("");
    const response = await fetch(`/api/v1/families/${familyId}/budgets/${budgetId}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      setMessage("無法刪除預算。");
      return;
    }
    setBudgets((current) => current.filter((item) => item.budget.id !== budgetId));
  }

  const monthlyExpense = summary?.monthlyExpenseByCategory.reduce((sum, item) => sum + item.amount, 0) ?? 0;
  const accountTotal = summary?.accountBalances.reduce((sum, item) => sum + item.balance, 0) ?? 0;
  const fundTotal = summary?.fundBalances.reduce((sum, item) => sum + item.balance, 0) ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="報表"
        title="家庭報表"
        description="查看月支出分類、個人帳戶餘額、共用基金餘額與預算使用狀態。"
        action={
          <div className="topbar-action">
            <button type="button" onClick={() => exportReport("csv")} disabled={!familyId}>匯出 CSV</button>
            <button type="button" onClick={() => exportReport("xls")} disabled={!familyId}>匯出 Excel</button>
          </div>
        }
      />
      {message ? <p className="error-text">{message}</p> : null}
      <div className="summary-grid">
        <article><p>月支出</p><strong>{formatCurrency(monthlyExpense)}</strong></article>
        <article><p>個人帳戶</p><strong>{formatCurrency(accountTotal)}</strong></article>
        <article><p>共用基金</p><strong>{formatCurrency(fundTotal)}</strong></article>
        <article><p>方案</p><strong>{plan ? (plan.plan === "paid" ? "付費" : "免費") : loading ? "載入中" : "未知"}</strong></article>
      </div>
      <div className="content-grid">
        <section className="panel">
          <h2>支出分類</h2>
          <div className="module-list">
            {(summary?.monthlyExpenseByCategory ?? []).map((item) => (
              <div className="module-row" key={item.category}><span>{item.category}</span><strong>{formatCurrency(item.amount)}</strong></div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>方案限制</h2>
          <div className="module-list">
            <div className="module-row"><span>報表範圍</span><small>{plan?.limits.reportsMonths ? `近 ${plan.limits.reportsMonths} 個月` : "不限"}</small></div>
            <div className="module-row"><span>報表匯出</span><small>{plan?.limits.canExportReports ? "可使用" : "付費方案"}</small></div>
            <div className="module-row"><span>廣告</span><small>{plan?.limits.hasAds ? "免費方案顯示" : "已隱藏"}</small></div>
          </div>
        </section>
        <section className="panel">
          <h2>預算</h2>
          <form action={createBudget} className="module-form">
            <input name="name" placeholder="預算名稱" required />
            <input name="category" placeholder="分類，例如餐飲" required />
            <input name="amount" inputMode="decimal" placeholder="金額" required />
            <button type="submit" disabled={!familyId}>新增預算</button>
          </form>
          <div className="module-list">
            {budgets.map((item) => (
              <div className="module-row" key={item.budget.id}>
                {editingBudgetId === item.budget.id ? (
                  <form onSubmit={(event) => void saveBudgetEdit(event)} className="module-form">
                    <input value={editingBudgetName} onChange={(event) => setEditingBudgetName(event.target.value)} required />
                    <input value={editingBudgetCategory} onChange={(event) => setEditingBudgetCategory(event.target.value)} />
                    <input value={editingBudgetAmount} onChange={(event) => setEditingBudgetAmount(event.target.value)} inputMode="decimal" required />
                    <div className="topbar-action">
                      <button type="submit">儲存</button>
                      <button type="button" onClick={() => setEditingBudgetId(null)}>取消</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <span>{item.budget.name}{item.budget.category ? `（${item.budget.category}）` : ""}</span>
                      <small>已花 {formatCurrency(item.spent)} / 預算 {formatCurrency(item.budget.amount)} / 剩餘 <strong className={item.exceeded ? "danger-inline" : undefined}>{formatCurrency(item.remaining)}</strong></small>
                    </div>
                    <div className="topbar-action">
                      <button type="button" onClick={() => startBudgetEdit(item)}>編輯</button>
                      <button type="button" className="danger-button" onClick={() => void removeBudget(item.budget.id)}>刪除</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>帳戶餘額</h2>
          <div className="module-list">{(summary?.accountBalances ?? []).map((item) => <div className="module-row" key={item.id}><span>{item.name}</span><strong>{formatCurrency(item.balance)}</strong></div>)}</div>
        </section>
        <section className="panel">
          <h2>基金餘額</h2>
          <div className="module-list">{(summary?.fundBalances ?? []).map((item) => <div className="module-row" key={item.id}><span>{item.name}</span><strong>{formatCurrency(item.balance)}</strong></div>)}</div>
        </section>
      </div>
      <AdPlacement placement="reports-bottom" />
    </>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}
