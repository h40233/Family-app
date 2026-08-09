"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useActiveFamily } from "@/features/families/use-active-family";
import { readOfflinePersonalQueue } from "@/features/money/offline-personal-queue";
import { useOnlineStatus } from "@/features/money/use-online-status";
import { apiRequest, errorMessage } from "@/lib/api-client";

type WishStatus = "submitted" | "rejected" | "pricing" | "price_pending_requester" | "active" | "price_change_pending" | "redeemed_pending_fulfillment" | "completed" | "cancelled";
type Wish = { id: string; requesterId: string; fulfillerId: string; title: string; description?: string; status: WishStatus; agreedPoints?: number };
type WishPriceProposal = { id: string; wishId: string; points: number; status: string };
type FamilyMember = {
  id: string;
  familyId: string;
  userId: string;
  displayName: string;
  role: string;
  isChildAccount: boolean;
};
type MembersResponse = { members: FamilyMember[] };

function wishStatusLabel(status: WishStatus) {
  const labels: Record<WishStatus, string> = {
    submitted: "已提出",
    rejected: "已駁回",
    pricing: "定價中",
    price_pending_requester: "等待提出者同意",
    active: "可兌換",
    price_change_pending: "等待價格變更同意",
    redeemed_pending_fulfillment: "已兌換，等待實現",
    completed: "已完成",
    cancelled: "已取消"
  };
  return labels[status];
}

export function WishesMvpView() {
  const activeFamily = useActiveFamily();
  const online = useOnlineStatus();
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [proposalIds, setProposalIds] = useState<Record<string, string>>({});
  const [queuedTransactions, setQueuedTransactions] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fulfillerId, setFulfillerId] = useState("");
  const [proposalPoints, setProposalPoints] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const memberNameById = useMemo(
    () => new Map(members.map((member) => [member.userId, member.displayName])),
    [members]
  );

  const stats = useMemo(() => ({
    active: wishes.filter((wish) => wish.status === "active").length,
    pending: wishes.filter((wish) => wish.status.includes("pending") || wish.status === "submitted").length,
    completed: wishes.filter((wish) => wish.status === "completed").length
  }), [wishes]);
  const canMutateWishes = online && queuedTransactions === 0;
  const wishMutationBlockMessage = !online
    ? "離線時不能修改願望。"
    : queuedTransactions > 0
      ? "請先同步個人離線交易，再修改願望。"
      : "";

  const loadWishes = useCallback(async (familyId: string, currentUserId: string) => {
    setLoading(true);
    try {
      const [loadedWishes, membersResponse] = await Promise.all([
        apiRequest<Wish[]>(`/api/v1/families/${familyId}/wishes`),
        apiRequest<MembersResponse>(`/api/v1/families/${familyId}/members`)
      ]);
      setWishes(loadedWishes);
      setMembers(membersResponse.members);
      setFulfillerId((current) => current || currentUserId);
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

    void loadWishes(activeFamily.family.id, activeFamily.user.id);
  }, [activeFamily, loadWishes]);

  useEffect(() => {
    function refreshQueueCount() {
      setQueuedTransactions(readOfflinePersonalQueue().length);
    }

    refreshQueueCount();
    window.addEventListener("storage", refreshQueueCount);
    window.addEventListener("online", refreshQueueCount);
    window.addEventListener("focus", refreshQueueCount);

    return () => {
      window.removeEventListener("storage", refreshQueueCount);
      window.removeEventListener("online", refreshQueueCount);
      window.removeEventListener("focus", refreshQueueCount);
    };
  }, []);

  function replaceWish(nextWish: Wish) {
    setWishes((current) => current.map((wish) => (wish.id === nextWish.id ? nextWish : wish)));
  }

  async function createWish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeFamily.status !== "ready") return;
    if (!canMutateWishes) {
      setMessage(wishMutationBlockMessage);
      return;
    }
    if (!title.trim()) return;
    const nextFulfillerId = fulfillerId || activeFamily.user.id;

    try {
      const wish = await apiRequest<Wish>(`/api/v1/families/${activeFamily.family.id}/wishes`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined, fulfillerId: nextFulfillerId })
      });
      setWishes((current) => [wish, ...current]);
      setTitle("");
      setDescription("");
      setMessage("願望已建立。");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function mutateWish(wish: Wish, action: "accept" | "reject" | "redeem" | "complete") {
    if (activeFamily.status !== "ready") return;
    if (!canMutateWishes) {
      setMessage(wishMutationBlockMessage);
      return;
    }

    try {
      const result = await apiRequest<Wish | { wishId: string }>(`/api/v1/families/${activeFamily.family.id}/wishes/${wish.id}/${action}`, { method: "POST" });
      if ("status" in result) replaceWish(result);
      else await loadWishes(activeFamily.family.id, activeFamily.user.id);
      setMessage("願望已更新。");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function proposePrice(wish: Wish) {
    if (activeFamily.status !== "ready") return;
    if (!canMutateWishes) {
      setMessage(wishMutationBlockMessage);
      return;
    }
    const points = proposalPoints[wish.id] ?? wish.agreedPoints ?? 100;

    try {
      const proposal = await apiRequest<WishPriceProposal>(`/api/v1/families/${activeFamily.family.id}/wishes/${wish.id}/price-proposals`, {
        method: "POST",
        body: JSON.stringify({ points, note: "由願望頁提出" })
      });
      setProposalIds((current) => ({ ...current, [wish.id]: proposal.id }));
      await loadWishes(activeFamily.family.id, activeFamily.user.id);
      setMessage(`已提出 ${proposal.points} 點的定價。`);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function resolvePrice(wish: Wish, approve: boolean) {
    if (activeFamily.status !== "ready") return;
    if (!canMutateWishes) {
      setMessage(wishMutationBlockMessage);
      return;
    }
    const proposalId = proposalIds[wish.id];
    if (!proposalId) {
      setMessage("請先提出價格，再同意或駁回。");
      return;
    }

    try {
      const nextWish = await apiRequest<Wish>(`/api/v1/families/${activeFamily.family.id}/wishes/${wish.id}/price-proposals/${proposalId}/${approve ? "approve" : "reject"}`, { method: "POST" });
      replaceWish(nextWish);
      setMessage(approve ? "價格已同意。" : "價格已駁回。");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  if (activeFamily.status !== "ready") {
    const displayMessage = "message" in activeFamily ? activeFamily.message : "正在載入登入與家庭資料。";

    return (
      <>
        <PageHeader eyebrow="願望清單" title="願望與獎勵" description="提出願望、協議兌換點數、兌換獎勵並追蹤實現狀態。" />
        <section className="panel">
          <h2>願望資料</h2>
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
      <PageHeader eyebrow="願望清單" title="願望與獎勵" description={`${activeFamily.family.name} 的願望、定價、兌換與實現狀態。`} />
      <div className="summary-grid">
        <article><p>願望總數</p><strong>{wishes.length}</strong></article>
        <article><p>可兌換</p><strong>{stats.active}</strong></article>
        <article><p>待處理</p><strong>{stats.pending}</strong></article>
        <article><p>已完成</p><strong>{stats.completed}</strong></article>
        <article><p>待同步</p><strong>{queuedTransactions}</strong></article>
      </div>
      {wishMutationBlockMessage ? <section className="panel" style={{ marginBottom: "1rem" }}><strong>{online ? "同步提醒" : "離線模式"}</strong><p className="muted">{wishMutationBlockMessage}</p></section> : null}
      <div className="content-grid">
        <section className="panel">
          <h2>願望列表</h2>
          {loading ? <p className="muted">載入中...</p> : null}
          {message ? <p className="page-description">{message}</p> : null}
          <div className="module-list">
            {wishes.map((wish) => (
              <div className="module-row" key={wish.id}>
                <div>
                  <span>{wish.title}</span>
                  <small>{wishStatusLabel(wish.status)}{wish.agreedPoints ? ` / ${wish.agreedPoints} 點` : ""}</small>
                  <small>
                    提出者 {memberNameById.get(wish.requesterId) ?? wish.requesterId} / 實現者 {memberNameById.get(wish.fulfillerId) ?? wish.fulfillerId}
                  </small>
                  {wish.description ? <small>{wish.description}</small> : null}
                </div>
                <div className="topbar-action" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {wish.status === "submitted" ? (
                    <>
                      <button type="button" disabled={!canMutateWishes} onClick={() => void mutateWish(wish, "accept")}>同意</button>
                      <button type="button" disabled={!canMutateWishes} onClick={() => void mutateWish(wish, "reject")} style={{ background: "var(--danger)" }}>駁回</button>
                    </>
                  ) : null}
                  {wish.status === "pricing" || wish.status === "active" ? (
                    <>
                      <input min={0} type="number" disabled={!canMutateWishes} value={proposalPoints[wish.id] ?? wish.agreedPoints ?? 100} onChange={(event) => setProposalPoints((current) => ({ ...current, [wish.id]: Number(event.target.value) }))} style={{ maxWidth: 96 }} />
                      <button type="button" disabled={!canMutateWishes} onClick={() => void proposePrice(wish)}>提出價格</button>
                    </>
                  ) : null}
                  {wish.status === "price_pending_requester" || wish.status === "price_change_pending" ? (
                    <>
                      <button type="button" disabled={!canMutateWishes} onClick={() => void resolvePrice(wish, true)}>同意價格</button>
                      <button type="button" disabled={!canMutateWishes} onClick={() => void resolvePrice(wish, false)} style={{ background: "var(--danger)" }}>駁回價格</button>
                    </>
                  ) : null}
                  {wish.status === "active" ? <button type="button" disabled={!canMutateWishes} onClick={() => void mutateWish(wish, "redeem")}>兌換</button> : null}
                  {wish.status === "redeemed_pending_fulfillment" ? <button type="button" disabled={!canMutateWishes} onClick={() => void mutateWish(wish, "complete")}>標記已實現</button> : null}
                </div>
              </div>
            ))}
            {!loading && wishes.length === 0 ? <p className="muted">目前沒有願望。</p> : null}
          </div>
        </section>
        <section className="panel">
          <h2>建立願望</h2>
          <form className="module-list" onSubmit={(event) => void createWish(event)}>
            <label><small>願望名稱</small><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label><small>說明</small><input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label>
              <small>實現者</small>
              <select value={fulfillerId || activeFamily.user.id} onChange={(event) => setFulfillerId(event.target.value)}>
                {memberOptions.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
              </select>
            </label>
            <button type="submit" disabled={loading || !canMutateWishes}>建立願望</button>
          </form>
        </section>
      </div>
    </>
  );
}
