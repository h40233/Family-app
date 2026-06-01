"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  apiRequest,
  errorMessage,
  formatCurrency,
  formatDateTime
} from "@/features/money/money-api";
import {
  clearOfflinePersonalQueue,
  createClientMutationId,
  enqueueOfflinePersonalTransaction,
  readOfflinePersonalQueue,
  type OfflinePersonalTransaction
} from "@/features/money/offline-personal-queue";
import { useOnlineStatus } from "@/features/money/use-online-status";

type PersonalAccount = {
  id: string;
  name: string;
  type: "cash" | "bank" | "e_wallet" | "other";
  balance: number;
};

type PersonalTransaction = {
  id: string;
  accountId: string;
  type: "income" | "expense";
  category?: string;
  amount: number;
  note?: string;
  occurredAt: string;
};

const accountTypeLabels: Record<PersonalAccount["type"], string> = {
  cash: "現金",
  bank: "銀行",
  e_wallet: "電子支付",
  other: "其他"
};

export function PersonalAccountingView() {
  const online = useOnlineStatus();
  const [accounts, setAccounts] = useState<PersonalAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [queuedTransactions, setQueuedTransactions] = useState<OfflinePersonalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts]
  );

  async function loadAccounts(nextSelectedId?: string) {
    setError("");
    const loadedAccounts = await apiRequest<PersonalAccount[]>("/api/v1/personal/accounts");
    setAccounts(loadedAccounts);

    const nextId = nextSelectedId || selectedAccountId || loadedAccounts[0]?.id || "";
    setSelectedAccountId(nextId);

    if (nextId) {
      await loadTransactions(nextId);
    } else {
      setTransactions([]);
    }
  }

  async function loadTransactions(accountId: string) {
    const loadedTransactions = await apiRequest<PersonalTransaction[]>(
      `/api/v1/personal/accounts/${accountId}/transactions`
    );
    setTransactions(loadedTransactions);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setQueuedTransactions(readOfflinePersonalQueue());

      try {
        const loadedAccounts = await apiRequest<PersonalAccount[]>("/api/v1/personal/accounts");
        if (cancelled) return;

        setAccounts(loadedAccounts);
        const firstAccountId = loadedAccounts[0]?.id ?? "";
        setSelectedAccountId(firstAccountId);

        if (firstAccountId) {
          const loadedTransactions = await apiRequest<PersonalTransaction[]>(
            `/api/v1/personal/accounts/${firstAccountId}/transactions`
          );
          if (!cancelled) setTransactions(loadedTransactions);
        }
      } catch (loadError) {
        if (!cancelled) setError(errorMessage(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (online) {
      void load();
    } else {
      setLoading(false);
      setQueuedTransactions(readOfflinePersonalQueue());
      setNotice("目前離線：你仍可新增個人記帳，資料會先存在本機佇列。");
    }

    return () => {
      cancelled = true;
    };
  }, [online]);

  async function handleAccountChange(accountId: string) {
    setSelectedAccountId(accountId);
    setError("");

    if (!online) {
      setNotice("離線時只能新增個人交易，帳戶交易列表會在連線後重新整理。");
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
      setNotice("建立帳戶需要連線後操作。");
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
      const account = await apiRequest<PersonalAccount>("/api/v1/personal/accounts", {
        method: "POST",
        body: JSON.stringify({ name, type })
      });
      event.currentTarget.reset();
      await loadAccounts(account.id);
      setNotice("帳戶已建立。");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccount) {
      setError("請先選擇或建立一個帳戶。");
      return;
    }

    const form = new FormData(event.currentTarget);
    const type: PersonalTransaction["type"] = form.get("type") === "income" ? "income" : "expense";
    const amount = Number(form.get("amount") ?? 0);
    const category = String(form.get("category") ?? "").trim() || undefined;
    const note = String(form.get("note") ?? "").trim() || undefined;
    const occurredAt = new Date().toISOString();

    if (!amount || amount <= 0) {
      setError("請輸入大於 0 的金額。");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      accountId: selectedAccount.id,
      clientMutationId: createClientMutationId(),
      type,
      category,
      amount,
      note,
      occurredAt
    };

    try {
      if (!online) {
        const queue = enqueueOfflinePersonalTransaction(payload);
        setQueuedTransactions(queue);
        event.currentTarget.reset();
        setNotice("已離線暫存，回到線上後請按同步。");
        return;
      }

      await apiRequest<PersonalTransaction>(
        `/api/v1/personal/accounts/${selectedAccount.id}/transactions`,
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
      event.currentTarget.reset();
      await loadAccounts(selectedAccount.id);
      setNotice("交易已新增，餘額已重新整理。");
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncQueue() {
    const queue = readOfflinePersonalQueue();

    if (!online) {
      setNotice("目前仍離線，連線後才能同步。");
      return;
    }

    if (queue.length === 0) {
      setNotice("沒有待同步的個人記帳。");
      return;
    }

    setSyncing(true);
    setError("");

    try {
      await apiRequest<{ transactions: PersonalTransaction[] }>("/api/v1/personal/offline-sync", {
        method: "POST",
        body: JSON.stringify({ transactions: queue })
      });
      clearOfflinePersonalQueue();
      setQueuedTransactions([]);
      await loadAccounts(selectedAccountId);
      setNotice("離線記帳已同步完成。");
    } catch (syncError) {
      setError(errorMessage(syncError));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="個人記帳"
        title="帳戶與交易"
        description="依帳戶查看交易紀錄，收入與支出會即時更新帳戶餘額；離線時僅允許新增個人記帳。"
        action={
          <button type="button" onClick={() => void handleSyncQueue()} disabled={syncing}>
            {syncing ? "同步中" : `同步離線 ${queuedTransactions.length}`}
          </button>
        }
      />

      {(notice || !online) && (
        <section className="panel" style={{ marginBottom: "1rem" }}>
          <strong>{online ? "提示" : "離線模式"}</strong>
          <p className="muted">
            {notice || "目前離線：只有個人記帳可新增，協作功能需連線後操作。"}
          </p>
        </section>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="summary-grid">
        <article>
          <p>總餘額</p>
          <strong>{formatCurrency(totalBalance)}</strong>
        </article>
        <article>
          <p>帳戶數</p>
          <strong>{accounts.length}</strong>
        </article>
        <article>
          <p>目前帳戶交易</p>
          <strong>{transactions.length}</strong>
        </article>
        <article>
          <p>待同步</p>
          <strong>{queuedTransactions.length}</strong>
        </article>
      </div>

      <div className="content-grid">
        <section className="panel">
          <h2>帳戶列表</h2>
          <div className="module-list">
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => void handleAccountChange(account.id)}
                style={{
                  background: account.id === selectedAccountId ? "var(--primary)" : "var(--surface)",
                  border: "1px solid var(--border)",
                  color: account.id === selectedAccountId ? "white" : "var(--text)",
                  textAlign: "left"
                }}
              >
                {account.name} · {accountTypeLabels[account.type]} · {formatCurrency(account.balance)}
              </button>
            ))}
            {!loading && accounts.length === 0 && <p className="muted">尚未建立帳戶。</p>}
          </div>

          <form onSubmit={(event) => void handleCreateAccount(event)} style={{ marginTop: "1rem" }}>
            <h2>建立帳戶</h2>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <input name="name" placeholder="帳戶名稱，例如現金、銀行 A" />
              <select name="type" defaultValue="cash">
                <option value="cash">現金</option>
                <option value="bank">銀行</option>
                <option value="e_wallet">電子支付</option>
                <option value="other">其他</option>
              </select>
              <button type="submit" disabled={saving || !online}>
                建立帳戶
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h2>{selectedAccount ? `${selectedAccount.name} 交易紀錄` : "交易紀錄"}</h2>
          <form onSubmit={(event) => void handleCreateTransaction(event)}>
            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
              <select name="type" defaultValue="expense">
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </select>
              <input name="amount" inputMode="decimal" placeholder="金額" />
              <input name="category" placeholder="分類，例如餐飲、薪資" />
              <input name="note" placeholder="備註" />
              <button type="submit" disabled={saving || !selectedAccount}>
                新增交易
              </button>
            </div>
          </form>

          <div className="module-list">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="module-row">
                <span>
                  {transaction.type === "income" ? "+" : "-"}
                  {formatCurrency(transaction.amount)}
                </span>
                <small>
                  {transaction.category ?? "未分類"} · {transaction.note ?? "無備註"} ·{" "}
                  {formatDateTime(transaction.occurredAt)}
                </small>
              </div>
            ))}
            {transactions.length === 0 && <p className="muted">目前帳戶尚無交易。</p>}
          </div>
        </section>
      </div>
    </>
  );
}
