"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";

const FAMILY_ID = "00000000-0000-4000-8000-000000001001";

type ApiEnvelope<T> = { data?: T; error?: { message: string } };
type PointBalance = { familyId: string; userId: string; balance: number; updatedAt: string };
type PointLedgerEntry = {
  id: string;
  userId: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  note?: string;
  createdAt: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `請求失敗：${response.status}`);
  return payload.data as T;
}

export function PointsMvpView() {
  const [myBalance, setMyBalance] = useState<PointBalance | null>(null);
  const [balances, setBalances] = useState<PointBalance[]>([]);
  const [ledger, setLedger] = useState<PointLedgerEntry[]>([]);
  const [targetUserId, setTargetUserId] = useState("00000000-0000-4000-8000-000000000001");
  const [delta, setDelta] = useState(10);
  const [reason, setReason] = useState("手動調整");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadPoints() {
    setLoading(true);
    try {
      const [mine, familyBalances, entries] = await Promise.all([
        api<PointBalance>(`/api/v1/families/${FAMILY_ID}/points/me`),
        api<PointBalance[]>(`/api/v1/families/${FAMILY_ID}/points/balances`),
        api<PointLedgerEntry[]>(`/api/v1/families/${FAMILY_ID}/points/ledger?limit=20`)
      ]);
      setMyBalance(mine);
      setBalances(familyBalances);
      setLedger(entries);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "點數載入失敗。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPoints();
  }, []);

  const stats = useMemo(() => {
    const familyTotal = balances.reduce((sum, balance) => sum + balance.balance, 0);
    const positiveLedger = ledger.filter((entry) => entry.delta > 0).length;
    const negativeLedger = ledger.filter((entry) => entry.delta < 0).length;
    return { familyTotal, positiveLedger, negativeLedger };
  }, [balances, ledger]);

  async function adjustPoints(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api<PointLedgerEntry>(`/api/v1/families/${FAMILY_ID}/points/adjust`, {
        method: "POST",
        body: JSON.stringify({ userId: targetUserId, delta, reason })
      });
      setMessage("點數已調整。");
      await loadPoints();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "點數調整失敗。");
    }
  }

  return (
    <>
      <PageHeader eyebrow="點數" title="家庭點數" description="查看家庭成員點數、手動調整紀錄與點數流水帳。" />
      <div className="summary-grid">
        <article><p>我的點數</p><strong>{myBalance?.balance ?? 0}</strong></article>
        <article><p>家庭總點數</p><strong>{stats.familyTotal}</strong></article>
        <article><p>增加紀錄</p><strong>{stats.positiveLedger}</strong></article>
        <article><p>扣除紀錄</p><strong>{stats.negativeLedger}</strong></article>
      </div>
      <div className="content-grid">
        <section className="panel">
          <h2>成員點數</h2>
          {loading ? <p className="muted">載入中...</p> : null}
          {message ? <p className="page-description">{message}</p> : null}
          <div className="module-list">
            {balances.map((balance) => (
              <div className="module-row" key={balance.userId}>
                <div><span>{balance.userId}</span><small>更新時間 {new Date(balance.updatedAt).toLocaleString()}</small></div>
                <strong>{balance.balance} 點</strong>
              </div>
            ))}
          </div>
          <h2 style={{ marginTop: "1.4rem" }}>點數紀錄</h2>
          <div className="module-list">
            {ledger.length === 0 ? <p className="muted">目前沒有點數紀錄。</p> : null}
            {ledger.map((entry) => (
              <div className="module-row" key={entry.id}>
                <div><span>{entry.delta > 0 ? "+" : ""}{entry.delta} 點</span><small>{entry.userId} / {entry.reason}{entry.note ? ` / ${entry.note}` : ""}</small></div>
                <small>調整後 {entry.balanceAfter}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>手動調整</h2>
          <form className="module-list" onSubmit={(event) => void adjustPoints(event)}>
            <label><small>使用者 ID</small><input value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} /></label>
            <label><small>調整點數</small><input type="number" value={delta} onChange={(event) => setDelta(Number(event.target.value))} /></label>
            <label><small>原因</small><input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <button type="submit">調整點數</button>
          </form>
        </section>
      </div>
    </>
  );
}
