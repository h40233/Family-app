"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useActiveFamily } from "@/features/families/use-active-family";
import { apiRequest, errorMessage } from "@/lib/api-client";

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
type FamilyMember = {
  id: string;
  familyId: string;
  userId: string;
  displayName: string;
  role: string;
  isChildAccount: boolean;
};
type MembersResponse = { members: FamilyMember[] };

function reasonLabel(reason: string) {
  const labels: Record<string, string> = {
    task_auto_award: "任務自動發分",
    task_review_award: "任務審核發分",
    manual_adjustment: "手動調整",
    wish_redemption: "願望兌換"
  };
  return labels[reason] ?? reason;
}

export function PointsMvpView() {
  const activeFamily = useActiveFamily();
  const [myBalance, setMyBalance] = useState<PointBalance | null>(null);
  const [balances, setBalances] = useState<PointBalance[]>([]);
  const [ledger, setLedger] = useState<PointLedgerEntry[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [delta, setDelta] = useState(10);
  const [reason, setReason] = useState("手動調整");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const memberNameById = useMemo(
    () => new Map(members.map((member) => [member.userId, member.displayName])),
    [members]
  );

  const stats = useMemo(() => {
    const familyTotal = balances.reduce((sum, balance) => sum + balance.balance, 0);
    const positiveLedger = ledger.filter((entry) => entry.delta > 0).length;
    const negativeLedger = ledger.filter((entry) => entry.delta < 0).length;
    return { familyTotal, positiveLedger, negativeLedger };
  }, [balances, ledger]);

  const loadPoints = useCallback(async (familyId: string, currentUserId: string) => {
    setLoading(true);
    try {
      const [mine, familyBalances, entries, membersResponse] = await Promise.all([
        apiRequest<PointBalance>(`/api/v1/families/${familyId}/points/me`),
        apiRequest<PointBalance[]>(`/api/v1/families/${familyId}/points/balances`),
        apiRequest<PointLedgerEntry[]>(`/api/v1/families/${familyId}/points/ledger?limit=20`),
        apiRequest<MembersResponse>(`/api/v1/families/${familyId}/members`)
      ]);
      setMyBalance(mine);
      setBalances(familyBalances);
      setLedger(entries);
      setMembers(membersResponse.members);
      setTargetUserId((current) => current || currentUserId);
      setMessage("");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeFamily.status !== "ready") {
      setLoading(activeFamily.status === "loading");
      return;
    }

    void loadPoints(activeFamily.family.id, activeFamily.user.id);
  }, [activeFamily, loadPoints]);

  async function adjustPoints(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeFamily.status !== "ready") return;
    const nextTargetUserId = targetUserId || activeFamily.user.id;

    try {
      await apiRequest<PointLedgerEntry>(`/api/v1/families/${activeFamily.family.id}/points/adjust`, {
        method: "POST",
        body: JSON.stringify({ userId: nextTargetUserId, delta, reason })
      });
      setMessage("點數已調整。");
      await loadPoints(activeFamily.family.id, activeFamily.user.id);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  if (activeFamily.status !== "ready") {
    const displayMessage = "message" in activeFamily ? activeFamily.message : "正在載入登入與家庭資料。";

    return (
      <>
        <PageHeader eyebrow="點數" title="家庭點數" description="查看家庭成員點數、手動調整紀錄與點數流水帳。" />
        <section className="panel">
          <h2>點數資料</h2>
          <p className="page-description">{displayMessage}</p>
        </section>
      </>
    );
  }

  const memberOptions = members.length > 0
    ? members
    : [{
        id: activeFamily.user.id,
        familyId: activeFamily.family.id,
        userId: activeFamily.user.id,
        displayName: activeFamily.user.displayName,
        role: "member",
        isChildAccount: activeFamily.user.isChildAccount
      }];

  return (
    <>
      <PageHeader eyebrow="點數" title="家庭點數" description={`${activeFamily.family.name} 的成員點數、手動調整紀錄與流水帳。`} />
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
                <div>
                  <span>{memberNameById.get(balance.userId) ?? balance.userId}</span>
                  <small>更新時間 {new Date(balance.updatedAt).toLocaleString()}</small>
                </div>
                <strong>{balance.balance} 點</strong>
              </div>
            ))}
            {!loading && balances.length === 0 ? <p className="muted">目前沒有點數資料。</p> : null}
          </div>
          <h2 style={{ marginTop: "1.4rem" }}>點數紀錄</h2>
          <div className="module-list">
            {ledger.length === 0 ? <p className="muted">目前沒有點數紀錄。</p> : null}
            {ledger.map((entry) => (
              <div className="module-row" key={entry.id}>
                <div>
                  <span>{entry.delta > 0 ? "+" : ""}{entry.delta} 點</span>
                  <small>{memberNameById.get(entry.userId) ?? entry.userId} / {reasonLabel(entry.reason)}{entry.note ? ` / ${entry.note}` : ""}</small>
                </div>
                <small>調整後 {entry.balanceAfter}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>手動調整</h2>
          <form className="module-list" onSubmit={(event) => void adjustPoints(event)}>
            <label>
              <small>成員</small>
              <select value={targetUserId || activeFamily.user.id} onChange={(event) => setTargetUserId(event.target.value)}>
                {memberOptions.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
              </select>
            </label>
            <label><small>調整點數</small><input type="number" value={delta} onChange={(event) => setDelta(Number(event.target.value))} /></label>
            <label><small>原因</small><input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <button type="submit" disabled={loading}>調整點數</button>
          </form>
        </section>
      </div>
    </>
  );
}
