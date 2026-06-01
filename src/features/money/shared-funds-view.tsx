"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ApiClientError, apiRequest, errorMessage, formatCurrency, formatDateTime } from "@/features/money/money-api";
import { useOnlineStatus } from "@/features/money/use-online-status";

type FamiliesResponse = { families: Array<{ id: string; name: string }> };
type SharedFund = { id: string; familyId: string; name: string; balance: number };
type FundTransaction = { id: string; fundId: string; type: "deposit" | "expense"; category?: string; amount: number; note?: string; actorUserId?: string; occurredAt: string };

export function SharedFundsView() {
  const online = useOnlineStatus();
  const [familyId, setFamilyId] = useState("");
  const [familyName, setFamilyName] = useState("尚未選擇家庭");
  const [funds, setFunds] = useState<SharedFund[]>([]);
  const [selectedFundId, setSelectedFundId] = useState("");
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [permissionNotice, setPermissionNotice] = useState("");

  const selectedFund = funds.find((fund) => fund.id === selectedFundId);
  const totalBalance = useMemo(() => funds.reduce((sum, fund) => sum + fund.balance, 0), [funds]);

  async function loadFamiliesAndFunds(nextSelectedFundId?: string) {
    setError("");
    setPermissionNotice("");
    const familiesResponse = await apiRequest<FamiliesResponse>("/api/v1/families");
    const family = familiesResponse.families[0];
    if (!family) {
      setFamilyId("");
      setFamilyName("尚未建立家庭");
      setFunds([]);
      setTransactions([]);
      return;
    }
    setFamilyId(family.id);
    setFamilyName(family.name);
    const loadedFunds = await apiRequest<SharedFund[]>(`/api/v1/families/${family.id}/funds`);
    setFunds(loadedFunds);
    const nextFundId = nextSelectedFundId || selectedFundId || loadedFunds[0]?.id || "";
    setSelectedFundId(nextFundId);
    if (nextFundId) await loadTransactions(family.id, nextFundId);
    else setTransactions([]);
  }

  async function loadTransactions(nextFamilyId: string, fundId: string) {
    setTransactions(await apiRequest<FundTransaction[]>(`/api/v1/families/${nextFamilyId}/funds/${fundId}/transactions`));
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!online) {
        setLoading(false);
        setPermissionNotice("共用基金需要網路連線才能查看與修改。");
        return;
      }
      setLoading(true);
      try {
        await loadFamiliesAndFunds();
      } catch (loadError) {
        if (!cancelled) {
          if (loadError instanceof ApiClientError && loadError.status === 403) setPermissionNotice("你沒有查看共用基金的權限。");
          else setError(errorMessage(loadError));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [online]);

  async function handleFundChange(fundId: string) {
    setSelectedFundId(fundId);
    setError("");
    setPermissionNotice("");
    if (!online) {
      setPermissionNotice("離線時無法切換基金資料。");
      return;
    }
    if (!familyId) return;
    try {
      await loadTransactions(familyId, fundId);
    } catch (loadError) {
      if (loadError instanceof ApiClientError && loadError.status === 403) setPermissionNotice("你沒有查看此基金交易紀錄的權限。");
      else setError(errorMessage(loadError));
    }
  }

  async function handleCreateFund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) {
      setPermissionNotice("建立共用基金需要網路連線。");
      return;
    }
    if (!familyId) {
      setError("請先建立或加入家庭。");
      return;
    }
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      setError("請輸入基金名稱。");
      return;
    }
    setSaving(true);
    setError("");
    setPermissionNotice("");
    try {
      const fund = await apiRequest<SharedFund>(`/api/v1/families/${familyId}/funds`, { method: "POST", body: JSON.stringify({ name }) });
      event.currentTarget.reset();
      await loadFamiliesAndFunds(fund.id);
    } catch (saveError) {
      if (saveError instanceof ApiClientError && saveError.status === 403) setPermissionNotice("你沒有建立共用基金的權限。");
      else setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) {
      setPermissionNotice("共用基金交易需要網路連線。");
      return;
    }
    if (!familyId || !selectedFund) {
      setError("請先選擇共用基金。");
      return;
    }
    const form = new FormData(event.currentTarget);
    const type = form.get("type") === "deposit" ? "deposit" : "expense";
    const amount = Number(form.get("amount") ?? 0);
    const category = String(form.get("category") ?? "").trim() || undefined;
    const note = String(form.get("note") ?? "").trim() || undefined;
    if (!amount || amount <= 0) {
      setError("請輸入大於 0 的金額。");
      return;
    }
    setSaving(true);
    setError("");
    setPermissionNotice("");
    try {
      await apiRequest<FundTransaction>(`/api/v1/families/${familyId}/funds/${selectedFund.id}/transactions`, {
        method: "POST",
        body: JSON.stringify({ type, amount, category, note, occurredAt: new Date().toISOString() })
      });
      event.currentTarget.reset();
      await loadFamiliesAndFunds(selectedFund.id);
    } catch (saveError) {
      if (saveError instanceof ApiClientError && saveError.status === 403) setPermissionNotice("你沒有新增此基金交易的權限。");
      else setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="共用基金" title="家庭共用基金" description={`${familyName} 的共用基金餘額與交易紀錄。`} action={<button type="button" disabled={!online || loading} onClick={() => void loadFamiliesAndFunds(selectedFundId)}>重新整理</button>} />
      {(!online || permissionNotice) && <section className="panel" style={{ marginBottom: "1rem" }}><strong>{online ? "權限提示" : "需要網路連線"}</strong><p className="muted">{permissionNotice || "共用基金需要網路連線才能操作。"}</p></section>}
      {error && <p className="error-text">{error}</p>}
      <div className="summary-grid">
        <article><p>基金總餘額</p><strong>{formatCurrency(totalBalance)}</strong></article>
        <article><p>基金數</p><strong>{funds.length}</strong></article>
        <article><p>目前交易</p><strong>{transactions.length}</strong></article>
        <article><p>連線狀態</p><strong>{online ? "線上" : "離線"}</strong></article>
      </div>
      <div className="content-grid">
        <section className="panel">
          <h2>基金列表</h2>
          <div className="module-list">
            {funds.map((fund) => (
              <button key={fund.id} type="button" onClick={() => void handleFundChange(fund.id)} disabled={!online} style={{ background: fund.id === selectedFundId ? "var(--primary)" : "var(--surface)", border: "1px solid var(--border)", color: fund.id === selectedFundId ? "white" : "var(--text)", textAlign: "left" }}>
                {fund.name} / {formatCurrency(fund.balance)}
              </button>
            ))}
            {!loading && funds.length === 0 && <p className="muted">目前沒有可查看的共用基金。</p>}
          </div>
          <form onSubmit={(event) => void handleCreateFund(event)} style={{ marginTop: "1rem" }}>
            <h2>新增共用基金</h2>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <input name="name" placeholder="基金名稱，例如家庭旅遊基金" />
              <button type="submit" disabled={saving || !online || !familyId}>新增基金</button>
            </div>
          </form>
        </section>
        <section className="panel">
          <h2>{selectedFund ? `${selectedFund.name} 交易紀錄` : "基金交易紀錄"}</h2>
          <form onSubmit={(event) => void handleCreateTransaction(event)}>
            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
              <select name="type" defaultValue="expense" disabled={!online}><option value="expense">支出</option><option value="deposit">存入</option></select>
              <input name="amount" inputMode="decimal" placeholder="金額" disabled={!online} />
              <input name="category" placeholder="分類，例如餐飲、交通" disabled={!online} />
              <input name="note" placeholder="備註" disabled={!online} />
              <button type="submit" disabled={saving || !online || !selectedFund}>新增基金交易</button>
            </div>
          </form>
          <div className="module-list">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="module-row">
                <span>{transaction.type === "deposit" ? "+" : "-"}{formatCurrency(transaction.amount)}</span>
                <small>{transaction.category ?? "未分類"} / {transaction.note ?? "無備註"} / {formatDateTime(transaction.occurredAt)}</small>
              </div>
            ))}
            {transactions.length === 0 && <p className="muted">此基金尚無交易。</p>}
          </div>
        </section>
      </div>
    </>
  );
}
