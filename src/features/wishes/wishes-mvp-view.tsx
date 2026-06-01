"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";

const FAMILY_ID = "00000000-0000-4000-8000-000000001001";
const DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000001";

type ApiEnvelope<T> = { data?: T; error?: { message: string } };
type WishStatus = "submitted" | "rejected" | "pricing" | "price_pending_requester" | "active" | "price_change_pending" | "redeemed_pending_fulfillment" | "completed" | "cancelled";
type Wish = { id: string; requesterId: string; fulfillerId: string; title: string; description?: string; status: WishStatus; agreedPoints?: number };
type WishPriceProposal = { id: string; wishId: string; points: number; status: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? `請求失敗：${response.status}`);
  return payload.data as T;
}

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
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [proposalIds, setProposalIds] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fulfillerId, setFulfillerId] = useState(DEFAULT_USER_ID);
  const [proposalPoints, setProposalPoints] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadWishes() {
    setLoading(true);
    try {
      setWishes(await api<Wish[]>(`/api/v1/families/${FAMILY_ID}/wishes`));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "願望載入失敗。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWishes();
  }, []);

  const stats = useMemo(() => ({
    active: wishes.filter((wish) => wish.status === "active").length,
    pending: wishes.filter((wish) => wish.status.includes("pending") || wish.status === "submitted").length,
    completed: wishes.filter((wish) => wish.status === "completed").length
  }), [wishes]);

  function replaceWish(nextWish: Wish) {
    setWishes((current) => current.map((wish) => (wish.id === nextWish.id ? nextWish : wish)));
  }

  async function createWish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const wish = await api<Wish>(`/api/v1/families/${FAMILY_ID}/wishes`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined, fulfillerId })
      });
      setWishes((current) => [wish, ...current]);
      setTitle("");
      setDescription("");
      setMessage("願望已建立。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "願望建立失敗。");
    }
  }

  async function mutateWish(wish: Wish, action: "accept" | "reject" | "redeem" | "complete") {
    try {
      const result = await api<Wish | { wishId: string }>(`/api/v1/families/${FAMILY_ID}/wishes/${wish.id}/${action}`, { method: "POST" });
      if ("status" in result) replaceWish(result);
      else await loadWishes();
      setMessage("願望已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "願望更新失敗。");
    }
  }

  async function proposePrice(wish: Wish) {
    const points = proposalPoints[wish.id] ?? wish.agreedPoints ?? 100;
    try {
      const proposal = await api<WishPriceProposal>(`/api/v1/families/${FAMILY_ID}/wishes/${wish.id}/price-proposals`, {
        method: "POST",
        body: JSON.stringify({ points, note: "由 MVP 介面提出" })
      });
      setProposalIds((current) => ({ ...current, [wish.id]: proposal.id }));
      await loadWishes();
      setMessage(`已提出 ${proposal.points} 點的定價。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "定價失敗。");
    }
  }

  async function resolvePrice(wish: Wish, approve: boolean) {
    const proposalId = proposalIds[wish.id];
    if (!proposalId) {
      setMessage("請先提出價格，再同意或駁回。");
      return;
    }
    try {
      const nextWish = await api<Wish>(`/api/v1/families/${FAMILY_ID}/wishes/${wish.id}/price-proposals/${proposalId}/${approve ? "approve" : "reject"}`, { method: "POST" });
      replaceWish(nextWish);
      setMessage(approve ? "價格已同意。" : "價格已駁回。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "價格處理失敗。");
    }
  }

  return (
    <>
      <PageHeader eyebrow="願望清單" title="願望與獎勵" description="提出願望、協議兌換點數、兌換獎勵並追蹤實現狀態。" />
      <div className="summary-grid">
        <article><p>願望總數</p><strong>{wishes.length}</strong></article>
        <article><p>可兌換</p><strong>{stats.active}</strong></article>
        <article><p>待處理</p><strong>{stats.pending}</strong></article>
        <article><p>已完成</p><strong>{stats.completed}</strong></article>
      </div>
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
                  {wish.description ? <small>{wish.description}</small> : null}
                </div>
                <div className="topbar-action" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {wish.status === "submitted" ? (
                    <>
                      <button type="button" onClick={() => void mutateWish(wish, "accept")}>同意</button>
                      <button type="button" onClick={() => void mutateWish(wish, "reject")} style={{ background: "var(--danger)" }}>駁回</button>
                    </>
                  ) : null}
                  {wish.status === "pricing" || wish.status === "active" ? (
                    <>
                      <input min={0} type="number" value={proposalPoints[wish.id] ?? wish.agreedPoints ?? 100} onChange={(event) => setProposalPoints((current) => ({ ...current, [wish.id]: Number(event.target.value) }))} style={{ maxWidth: 96 }} />
                      <button type="button" onClick={() => void proposePrice(wish)}>提出價格</button>
                    </>
                  ) : null}
                  {wish.status === "price_pending_requester" || wish.status === "price_change_pending" ? (
                    <>
                      <button type="button" onClick={() => void resolvePrice(wish, true)}>同意價格</button>
                      <button type="button" onClick={() => void resolvePrice(wish, false)} style={{ background: "var(--danger)" }}>駁回價格</button>
                    </>
                  ) : null}
                  {wish.status === "active" ? <button type="button" onClick={() => void mutateWish(wish, "redeem")}>兌換</button> : null}
                  {wish.status === "redeemed_pending_fulfillment" ? <button type="button" onClick={() => void mutateWish(wish, "complete")}>標記已實現</button> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>建立願望</h2>
          <form className="module-list" onSubmit={(event) => void createWish(event)}>
            <label><small>願望名稱</small><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label><small>說明</small><input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label><small>實現者 ID</small><input value={fulfillerId} onChange={(event) => setFulfillerId(event.target.value)} /></label>
            <button type="submit">建立願望</button>
          </form>
        </section>
      </div>
    </>
  );
}
