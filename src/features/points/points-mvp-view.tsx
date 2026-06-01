"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";

const FAMILY_ID = "00000000-0000-4000-8000-000000001001";

type ApiEnvelope<T> = { data?: T; error?: { message: string } };

type PointBalance = {
  familyId: string;
  userId: string;
  balance: number;
  updatedAt: string;
};

type PointLedgerEntry = {
  id: string;
  userId: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  note?: string;
  actorUserId: string;
  createdAt: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `Request failed: ${response.status}`);
  }

  return payload.data as T;
}

export function PointsMvpView() {
  const [myBalance, setMyBalance] = useState<PointBalance | null>(null);
  const [balances, setBalances] = useState<PointBalance[]>([]);
  const [ledger, setLedger] = useState<PointLedgerEntry[]>([]);
  const [targetUserId, setTargetUserId] = useState("00000000-0000-4000-8000-000000000001");
  const [delta, setDelta] = useState(10);
  const [reason, setReason] = useState("Manual MVP adjustment");
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
      setMessage(error instanceof Error ? error.message : "蝛?頛憭望?");
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
      setMessage("Points adjusted.");
      await loadPoints();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "隤踵蝛?憭望?");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Points"
        title="Family points"
        description="Track family point balances, manual adjustments, and the audit ledger."
      />

      <div className="summary-grid">
        <article>
          <p>??蝛?</p>
          <strong>{myBalance?.balance ?? 0}</strong>
        </article>
        <article>
          <p>摰嗅滬蝮賢?</p>
          <strong>{stats.familyTotal}</strong>
        </article>
        <article>
          <p>Positive entries</p>
          <strong>{stats.positiveLedger}</strong>
        </article>
        <article>
          <p>Negative entries</p>
          <strong>{stats.negativeLedger}</strong>
        </article>
      </div>

      <div className="content-grid">
        <section className="panel">
          <h2>Member balances</h2>
          {loading ? <p className="muted">頛銝?..</p> : null}
          {message ? <p className="page-description">{message}</p> : null}
          <div className="module-list">
            {balances.map((balance) => (
              <div className="module-row" key={balance.userId}>
                <div>
                  <span>{balance.userId}</span>
                  <small>Updated {new Date(balance.updatedAt).toLocaleString()}</small>
                </div>
                <strong>{balance.balance} pts</strong>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: "1.4rem" }}>Ledger</h2>
          <div className="module-list">
            {ledger.length === 0 ? <p className="muted">No point ledger entries yet.</p> : null}
            {ledger.map((entry) => (
              <div className="module-row" key={entry.id}>
                <div>
                  <span>
                    {entry.delta > 0 ? "+" : ""}
                    {entry.delta} pts
                  </span>
                  <small>
                    {entry.userId} 繚 {entry.reason}
                    {entry.note ? ` 繚 ${entry.note}` : ""}
                  </small>
                </div>
                <small>Balance {entry.balanceAfter}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>??隤踹?</h2>
          <form className="module-list" onSubmit={(event) => void adjustPoints(event)}>
            <label>
              <small>? ID</small>
              <input value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} />
            </label>
            <label>
              <small>?霈?</small>
              <input
                type="number"
                value={delta}
                onChange={(event) => setDelta(Number(event.target.value))}
              />
            </label>
            <label>
              <small>??</small>
              <input value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <button type="submit">隤踵蝛?</button>
          </form>
        </section>
      </div>
    </>
  );
}
