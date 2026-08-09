"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { apiRequest, errorMessage, formatCurrency, formatDateTime } from "@/features/money/money-api";
import {
  createClientMutationId,
  enqueueOfflinePersonalTransaction,
  readOfflinePersonalQueue,
  removeSyncedOfflinePersonalTransactions,
  type OfflinePersonalTransaction
} from "@/features/money/offline-personal-queue";
import { useOnlineStatus } from "@/features/money/use-online-status";

type TransactionType = "income" | "expense";
type PersonalSharingLevel = "none" | "balance_only" | "category_summary" | "partial_transactions" | "full";
type FamiliesResponse = { families: Array<{ id: string; name: string }> };
type PersonalAccount = { id: string; name: string; type: "cash" | "bank" | "e_wallet" | "other"; balance: number };
type PersonalCategory = {
  id: string;
  parentId?: string;
  parentName?: string;
  type: TransactionType;
  name: string;
  isSystem: boolean;
  children?: PersonalCategory[];
};
type PersonalTransaction = {
  id: string;
  accountId: string;
  clientMutationId?: string;
  type: TransactionType;
  categoryId?: string;
  category?: string;
  amount: number;
  note?: string;
  occurredAt: string;
};
type FamilyPersonalSharingEntry = {
  userId: string;
  displayName: string;
  sharingLevel: PersonalSharingLevel;
  totalBalance?: number;
  accounts?: Array<{ id: string; name: string; type: PersonalAccount["type"]; balance: number }>;
  categorySummaries?: Array<{ category: string; income: number; expense: number; transactionCount: number }>;
  transactions?: Array<{ id: string; accountName?: string; type: TransactionType; category?: string; amount: number; note?: string; occurredAt: string }>;
};

const accountTypeLabels: Record<PersonalAccount["type"], string> = {
  cash: "現金",
  bank: "銀行",
  e_wallet: "電子錢包",
  other: "其他"
};

const transactionTypeLabels: Record<TransactionType, string> = {
  expense: "支出",
  income: "收入"
};

const sharingLevelLabels: Record<PersonalSharingLevel, string> = {
  none: "不分享",
  balance_only: "只分享總餘額",
  category_summary: "分類統計",
  partial_transactions: "部分交易",
  full: "完整帳本"
};

function flattenCategories(categories: PersonalCategory[]): PersonalCategory[] {
  return categories.flatMap((category) => [category, ...(category.children ?? [])]);
}

function categoryDisplayName(category?: PersonalCategory) {
  if (!category) return "未分類";
  return category.parentName ? `${category.parentName} > ${category.name}` : category.name;
}

export function PersonalAccountingView() {
  const online = useOnlineStatus();
  const [accounts, setAccounts] = useState<PersonalAccount[]>([]);
  const [categories, setCategories] = useState<PersonalCategory[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [familyId, setFamilyId] = useState("");
  const [sharingLevel, setSharingLevel] = useState<PersonalSharingLevel>("none");
  const [sharingTransactionLimit, setSharingTransactionLimit] = useState(10);
  const [sharingIncludeNotes, setSharingIncludeNotes] = useState(false);
  const [familySharing, setFamilySharing] = useState<FamilyPersonalSharingEntry[]>([]);
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [queuedTransactions, setQueuedTransactions] = useState<OfflinePersonalTransaction[]>([]);
  const [transactionType, setTransactionType] = useState<TransactionType>("expense");
  const [selectedParentCategoryId, setSelectedParentCategoryId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<TransactionType>("expense");
  const [newCategoryLevel, setNewCategoryLevel] = useState<"parent" | "child">("child");
  const [newCategoryParentId, setNewCategoryParentId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const syncInFlightRef = useRef(false);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const totalBalance = useMemo(() => accounts.reduce((sum, account) => sum + account.balance, 0), [accounts]);
  const categoryParents = useMemo(
    () => categories.filter((category) => category.type === transactionType),
    [categories, transactionType]
  );
  const newCategoryParents = useMemo(
    () => categories.filter((category) => category.type === newCategoryType),
    [categories, newCategoryType]
  );
  const selectedParentCategory = categoryParents.find((category) => category.id === selectedParentCategoryId);
  const childCategoryOptions = selectedParentCategory?.children ?? [];
  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const categoryById = useMemo(
    () => new Map(flatCategories.map((category) => [category.id, category])),
    [flatCategories]
  );

  async function loadCategories() {
    setCategories(await apiRequest<PersonalCategory[]>("/api/v1/personal/categories"));
  }

  async function loadAccounts(nextSelectedId?: string) {
    setError("");
    const loadedAccounts = await apiRequest<PersonalAccount[]>("/api/v1/personal/accounts");
    setAccounts(loadedAccounts);
    const nextId = nextSelectedId || selectedAccountId || loadedAccounts[0]?.id || "";
    setSelectedAccountId(nextId);
    if (nextId) await loadTransactions(nextId);
    else setTransactions([]);
  }

  async function loadTransactions(accountId: string) {
    setTransactions(await apiRequest<PersonalTransaction[]>(`/api/v1/personal/accounts/${accountId}/transactions`));
  }

  async function loadSharing(nextFamilyId: string) {
    const [setting, sharing] = await Promise.all([
      apiRequest<{ sharingLevel: PersonalSharingLevel; config?: { transactionLimit?: number; includeNotes?: boolean } }>(`/api/v1/personal/sharing/${nextFamilyId}`),
      apiRequest<FamilyPersonalSharingEntry[]>(`/api/v1/families/${nextFamilyId}/personal-sharing`)
    ]);

    setSharingLevel(setting.sharingLevel);
    setSharingTransactionLimit(setting.config?.transactionLimit ?? 10);
    setSharingIncludeNotes(setting.config?.includeNotes === true);
    setFamilySharing(sharing);
  }

  useEffect(() => {
    const firstParentId = categoryParents[0]?.id ?? "";
    setSelectedParentCategoryId((current) =>
      categoryParents.some((category) => category.id === current) ? current : firstParentId
    );
  }, [categoryParents]);

  useEffect(() => {
    const validCategoryIds = new Set([selectedParentCategory?.id, ...childCategoryOptions.map((category) => category.id)].filter(Boolean));
    const fallbackCategoryId = childCategoryOptions[0]?.id ?? selectedParentCategory?.id ?? "";
    setSelectedCategoryId((current) => (validCategoryIds.has(current) ? current : fallbackCategoryId));
  }, [childCategoryOptions, selectedParentCategory]);

  useEffect(() => {
    const firstParentId = newCategoryParents[0]?.id ?? "";
    setNewCategoryParentId((current) =>
      newCategoryParents.some((category) => category.id === current) ? current : firstParentId
    );
  }, [newCategoryParents]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setQueuedTransactions(readOfflinePersonalQueue());
      try {
        const [loadedAccounts, loadedCategories, familiesResponse] = await Promise.all([
          apiRequest<PersonalAccount[]>("/api/v1/personal/accounts"),
          apiRequest<PersonalCategory[]>("/api/v1/personal/categories"),
          apiRequest<FamiliesResponse>("/api/v1/families")
        ]);
        if (cancelled) return;
        setAccounts(loadedAccounts);
        setCategories(loadedCategories);
        const family = familiesResponse.families[0];
        setFamilyId(family?.id ?? "");
        const firstAccountId = loadedAccounts[0]?.id ?? "";
        setSelectedAccountId(firstAccountId);
        if (firstAccountId) {
          const loadedTransactions = await apiRequest<PersonalTransaction[]>(`/api/v1/personal/accounts/${firstAccountId}/transactions`);
          if (!cancelled) setTransactions(loadedTransactions);
        }
        if (family) await loadSharing(family.id);
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (online) void load();
    else {
      setLoading(false);
      setQueuedTransactions(readOfflinePersonalQueue());
      setNotice("目前離線。你仍可新增個人交易，系統會暫存並在恢復連線後同步。");
    }
    return () => {
      cancelled = true;
    };
  }, [online]);

  async function handleAccountChange(accountId: string) {
    setSelectedAccountId(accountId);
    setError("");
    if (!online) {
      setNotice("離線時無法切換並載入帳戶交易紀錄。");
      return;
    }
    try {
      await loadTransactions(accountId);
    } catch (loadError) {
      setError(errorMessage(loadError));
    }
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) {
      setNotice("建立帳戶需要網路連線。");
      return;
    }
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const type = String(form.get("type") ?? "other");
    if (!name) {
      setError("請輸入帳戶名稱。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const account = await apiRequest<PersonalAccount>("/api/v1/personal/accounts", { method: "POST", body: JSON.stringify({ name, type }) });
      event.currentTarget.reset();
      await loadAccounts(account.id);
      setNotice("帳戶已建立。");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount(account: PersonalAccount) {
    if (!online) {
      setNotice("刪除帳戶需要網路連線。");
      return;
    }
    if (!window.confirm(`確定要刪除「${account.name}」嗎？交易紀錄會保留，但帳戶會從列表隱藏。`)) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/v1/personal/accounts/${account.id}`, { method: "DELETE" });
      const nextAccountId = accounts.find((item) => item.id !== account.id)?.id ?? "";
      await loadAccounts(nextAccountId);
      setNotice("帳戶已刪除。");
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) {
      setNotice("分類管理需要網路連線。");
      return;
    }
    const name = newCategoryName.trim();
    if (!name) {
      setError("請輸入分類名稱。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiRequest<PersonalCategory>("/api/v1/personal/categories", {
        method: "POST",
        body: JSON.stringify({
          type: newCategoryType,
          parentId: newCategoryLevel === "child" ? newCategoryParentId : undefined,
          name
        })
      });
      setNewCategoryName("");
      await loadCategories();
      setNotice("分類已新增。");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(category: PersonalCategory) {
    if (!online) {
      setNotice("分類管理需要網路連線。");
      return;
    }
    if (category.isSystem) {
      setNotice("系統預設分類不能刪除。");
      return;
    }
    if (!window.confirm(`確定要刪除「${categoryDisplayName(category)}」嗎？既有交易仍會保留原分類名稱。`)) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/v1/personal/categories/${category.id}`, { method: "DELETE" });
      await loadCategories();
      setNotice("分類已刪除。");
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount) {
      setError("請先選擇帳戶。");
      return;
    }
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount") ?? 0);
    const note = String(form.get("note") ?? "").trim() || undefined;
    if (!amount || amount <= 0) {
      setError("請輸入大於 0 的金額。");
      return;
    }
    setSaving(true);
    setError("");
    const selectedCategory = categoryById.get(selectedCategoryId);
    const payload = {
      accountId: selectedAccount.id,
      clientMutationId: createClientMutationId(),
      type: transactionType,
      categoryId: selectedCategory?.id,
      category: categoryDisplayName(selectedCategory),
      amount,
      note,
      occurredAt: new Date().toISOString()
    };
    try {
      if (!online) {
        setQueuedTransactions(enqueueOfflinePersonalTransaction(payload));
        event.currentTarget.reset();
        setNotice("交易已暫存，恢復連線後可同步。");
        return;
      }
      await apiRequest<PersonalTransaction>(`/api/v1/personal/accounts/${selectedAccount.id}/transactions`, { method: "POST", body: JSON.stringify(payload) });
      event.currentTarget.reset();
      await loadAccounts(selectedAccount.id);
      setNotice("交易已新增。");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncQueue() {
    if (syncInFlightRef.current) return;

    const queue = readOfflinePersonalQueue();
    if (!online) {
      setNotice("請恢復連線後再同步。");
      return;
    }
    if (queue.length === 0) {
      setNotice("沒有待同步交易。");
      return;
    }
    syncInFlightRef.current = true;
    setSyncing(true);
    setError("");
    try {
      const result = await apiRequest<{ transactions: PersonalTransaction[] }>("/api/v1/personal/offline-sync", { method: "POST", body: JSON.stringify({ transactions: queue }) });
      const syncedClientMutationIds = result.transactions
        .map((transaction) => transaction.clientMutationId)
        .filter((clientMutationId): clientMutationId is string => Boolean(clientMutationId));
      setQueuedTransactions(removeSyncedOfflinePersonalTransactions(syncedClientMutationIds));
      await loadAccounts(selectedAccountId);
      setNotice("離線交易已同步。");
    } catch (syncError) {
      setError(errorMessage(syncError));
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (!online || queuedTransactions.length === 0) return;

    void handleSyncQueue();
  }, [online, queuedTransactions.length]);

  async function handleUpdateSharing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online) {
      setNotice("分享設定需要網路連線。");
      return;
    }
    if (!familyId) {
      setError("請先建立或加入家庭。");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/v1/personal/sharing/${familyId}`, {
        method: "PATCH",
        body: JSON.stringify({
          sharingLevel,
          config:
            sharingLevel === "partial_transactions"
              ? {
                  transactionLimit: sharingTransactionLimit,
                  includeNotes: sharingIncludeNotes
                }
              : {}
        })
      });
      await loadSharing(familyId);
      setNotice("分享設定已更新。");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="個人記帳"
        title="個人帳本"
        description="依帳戶查看現金、銀行與電子錢包餘額，並用大類與小類記錄收入支出。"
        action={<button type="button" onClick={() => void handleSyncQueue()} disabled={syncing}>{syncing ? "同步中" : `同步離線交易 ${queuedTransactions.length}`}</button>}
      />
      {(notice || !online) && <section className="panel" style={{ marginBottom: "1rem" }}><strong>{online ? "提示" : "離線模式"}</strong><p className="muted">{notice || "目前離線，僅可暫存個人交易。"}</p></section>}
      {error && <p className="error-text">{error}</p>}
      <div className="summary-grid">
        <article><p>總餘額</p><strong>{formatCurrency(totalBalance)}</strong></article>
        <article><p>帳戶數</p><strong>{accounts.length}</strong></article>
        <article><p>本帳戶交易</p><strong>{transactions.length}</strong></article>
        <article><p>待同步</p><strong>{queuedTransactions.length}</strong></article>
      </div>
      <div className="content-grid">
        <section className="panel">
          <h2>帳戶列表</h2>
          <div className="module-list">
            {accounts.map((account) => (
              <div key={account.id} className="module-row" style={{ background: account.id === selectedAccountId ? "rgba(47, 111, 96, 0.08)" : "var(--surface)" }}>
                <div>
                  <span>{account.name}</span>
                  <small>{accountTypeLabels[account.type]} / {formatCurrency(account.balance)}</small>
                </div>
                <div className="topbar-action">
                  <button type="button" onClick={() => void handleAccountChange(account.id)} disabled={!online}>查看</button>
                  <button type="button" className="danger-button" onClick={() => void handleDeleteAccount(account)} disabled={!online || saving}>刪除</button>
                </div>
              </div>
            ))}
            {!loading && accounts.length === 0 && <p className="muted">尚未建立帳戶。</p>}
          </div>
          <form onSubmit={(event) => void handleCreateAccount(event)} style={{ marginTop: "1rem" }}>
            <h2>新增帳戶</h2>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <input name="name" placeholder="帳戶名稱，例如現金或銀行 A" />
              <select name="type" defaultValue="cash">
                <option value="cash">現金</option>
                <option value="bank">銀行</option>
                <option value="e_wallet">電子錢包</option>
                <option value="other">其他</option>
              </select>
              <button type="submit" disabled={saving || !online}>新增帳戶</button>
            </div>
          </form>
        </section>
        <section className="panel">
          <h2>{selectedAccount ? `${selectedAccount.name} 交易紀錄` : "交易紀錄"}</h2>
          <form onSubmit={(event) => void handleCreateTransaction(event)}>
            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
              <label><small>收支類型</small><select value={transactionType} onChange={(event) => setTransactionType(event.target.value as TransactionType)}><option value="expense">支出</option><option value="income">收入</option></select></label>
              <label>
                <small>大類</small>
                <select value={selectedParentCategoryId} onChange={(event) => setSelectedParentCategoryId(event.target.value)}>
                  {categoryParents.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>
                <small>小類</small>
                <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)}>
                  {childCategoryOptions.length === 0 && selectedParentCategory ? <option value={selectedParentCategory.id}>{selectedParentCategory.name}</option> : null}
                  {childCategoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <input name="amount" inputMode="decimal" placeholder="金額" />
              <input name="note" placeholder="備註" />
              <button type="submit" disabled={saving || !selectedAccount}>新增交易</button>
            </div>
          </form>
          <div className="module-list">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="module-row">
                <span>{transaction.type === "income" ? "+" : "-"}{formatCurrency(transaction.amount)}</span>
                <small>{transaction.category ?? "未分類"} / {transaction.note ?? "無備註"} / {formatDateTime(transaction.occurredAt)}</small>
              </div>
            ))}
            {transactions.length === 0 && <p className="muted">此帳戶尚無交易。</p>}
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2>分享設定</h2>
        <form onSubmit={(event) => void handleUpdateSharing(event)} style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
          <select value={sharingLevel} onChange={(event) => setSharingLevel(event.target.value as PersonalSharingLevel)} disabled={!online || !familyId}>
            <option value="none">不分享</option>
            <option value="balance_only">只分享總餘額</option>
            <option value="category_summary">分類統計</option>
            <option value="partial_transactions">部分交易</option>
            <option value="full">完整帳本</option>
          </select>
          <label>
            <small>部分交易筆數</small>
            <input
              type="number"
              min={1}
              max={100}
              value={sharingTransactionLimit}
              onChange={(event) => setSharingTransactionLimit(Number(event.target.value))}
              disabled={!online || sharingLevel !== "partial_transactions"}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={sharingIncludeNotes}
              onChange={(event) => setSharingIncludeNotes(event.target.checked)}
              disabled={!online || sharingLevel !== "partial_transactions"}
            />
            <small>包含備註</small>
          </label>
          <button type="submit" disabled={saving || !online || !familyId}>儲存分享設定</button>
        </form>
        <div className="module-list">
          {familySharing.map((entry) => (
            <div key={entry.userId} className="module-row">
              <div>
                <span>{entry.displayName}</span>
                <small>
                  {sharingLevelLabels[entry.sharingLevel]}
                  {entry.totalBalance !== undefined ? ` / ${formatCurrency(entry.totalBalance)}` : ""}
                </small>
                {entry.accounts?.length ? (
                  <small>{entry.accounts.map((account) => `${account.name} ${formatCurrency(account.balance)}`).join("、")}</small>
                ) : null}
                {entry.categorySummaries?.length ? (
                  <small>{entry.categorySummaries.map((summary) => `${summary.category} ${formatCurrency(summary.expense || summary.income)}`).join("、")}</small>
                ) : null}
                {entry.transactions?.length ? (
                  <small>{entry.transactions.map((transaction) => `${transaction.type === "income" ? "+" : "-"}${formatCurrency(transaction.amount)} ${transaction.note ?? transaction.category ?? ""}`).join("、")}</small>
                ) : null}
              </div>
            </div>
          ))}
          {!loading && familySharing.length === 0 && <p className="muted">尚未取得家庭分享摘要。</p>}
        </div>
      </section>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2>分類管理</h2>
        <form onSubmit={(event) => void handleCreateCategory(event)} style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
          <select value={newCategoryType} onChange={(event) => setNewCategoryType(event.target.value as TransactionType)}>
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
          <select value={newCategoryLevel} onChange={(event) => setNewCategoryLevel(event.target.value as "parent" | "child")}>
            <option value="child">新增小類</option>
            <option value="parent">新增大類</option>
          </select>
          {newCategoryLevel === "child" ? (
            <select value={newCategoryParentId} onChange={(event) => setNewCategoryParentId(event.target.value)}>
              {newCategoryParents.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          ) : null}
          <input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder={newCategoryLevel === "child" ? "小類名稱，例如早餐" : "大類名稱，例如食"} />
          <button type="submit" disabled={saving || !online || (newCategoryLevel === "child" && !newCategoryParentId)}>新增分類</button>
        </form>
        <div className="module-list">
          {categories.map((parent) => (
            <div key={parent.id} className="module-row">
              <div>
                <span>{transactionTypeLabels[parent.type]} / {parent.name}</span>
                <small>{parent.isSystem ? "系統預設" : "自訂"}{parent.children?.length ? ` / 小類：${parent.children.map((child) => child.name).join("、")}` : ""}</small>
              </div>
              <div className="topbar-action">
                {!parent.isSystem ? <button type="button" className="danger-button" onClick={() => void handleDeleteCategory(parent)} disabled={saving || !online}>刪除</button> : null}
                {(parent.children ?? []).filter((child) => !child.isSystem).map((child) => (
                  <button key={child.id} type="button" className="danger-button" onClick={() => void handleDeleteCategory(child)} disabled={saving || !online}>
                    刪除 {child.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
