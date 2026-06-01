"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/page-header";

const FAMILY_ID = "00000000-0000-4000-8000-000000001001";
const DEFAULT_USER_ID = "00000000-0000-4000-8000-000000000001";

type ApiEnvelope<T> = { data?: T; error?: { message: string } };

type WishStatus =
  | "submitted"
  | "rejected"
  | "pricing"
  | "price_pending_requester"
  | "active"
  | "price_change_pending"
  | "redeemed_pending_fulfillment"
  | "completed"
  | "cancelled";

type Wish = {
  id: string;
  requesterId: string;
  fulfillerId: string;
  title: string;
  description?: string;
  status: WishStatus;
  agreedPoints?: number;
};

type WishPriceProposal = {
  id: string;
  wishId: string;
  points: number;
  status: string;
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

function wishStatusLabel(status: WishStatus) {
  const labels: Record<WishStatus, string> = {
    submitted: "Submitted",
    rejected: "Rejected",
    pricing: "Pricing",
    price_pending_requester: "Waiting requester approval",
    active: "Active",
    price_change_pending: "Price change pending",
    redeemed_pending_fulfillment: "Redeemed, waiting fulfillment",
    completed: "Completed",
    cancelled: "Cancelled"
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
      setMessage(error instanceof Error ? error.message : "Failed to load wishes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWishes();
  }, []);

  const stats = useMemo(() => {
    return {
      active: wishes.filter((wish) => wish.status === "active").length,
      pending: wishes.filter(
        (wish) => wish.status.includes("pending") || wish.status === "submitted"
      ).length,
      completed: wishes.filter((wish) => wish.status === "completed").length
    };
  }, [wishes]);

  function replaceWish(nextWish: Wish) {
    setWishes((current) => current.map((wish) => (wish.id === nextWish.id ? nextWish : wish)));
  }

  async function createWish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;

    try {
      const wish = await api<Wish>(`/api/v1/families/${FAMILY_ID}/wishes`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          fulfillerId
        })
      });
      setWishes((current) => [wish, ...current]);
      setTitle("");
      setDescription("");
      setMessage("Wish created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create wish.");
    }
  }

  async function mutateWish(wish: Wish, action: "accept" | "reject" | "redeem" | "complete") {
    try {
      const result = await api<Wish | { wishId: string }>(
        `/api/v1/families/${FAMILY_ID}/wishes/${wish.id}/${action}`,
        { method: "POST" }
      );
      if ("status" in result) replaceWish(result);
      else await loadWishes();
      setMessage("Wish updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update wish.");
    }
  }

  async function proposePrice(wish: Wish) {
    const points = proposalPoints[wish.id] ?? wish.agreedPoints ?? 100;
    try {
      const proposal = await api<WishPriceProposal>(
        `/api/v1/families/${FAMILY_ID}/wishes/${wish.id}/price-proposals`,
        {
          method: "POST",
          body: JSON.stringify({ points, note: "Proposed from MVP UI" })
        }
      );
      setProposalIds((current) => ({ ...current, [wish.id]: proposal.id }));
      await loadWishes();
      setMessage(`Proposed ${proposal.points} points.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to propose a price.");
    }
  }

  async function resolvePrice(wish: Wish, approve: boolean) {
    const proposalId = proposalIds[wish.id];
    if (!proposalId) {
      setMessage("Create a price proposal before approving or rejecting it.");
      return;
    }

    try {
      const nextWish = await api<Wish>(
        `/api/v1/families/${FAMILY_ID}/wishes/${wish.id}/price-proposals/${proposalId}/${
          approve ? "approve" : "reject"
        }`,
        { method: "POST" }
      );
      replaceWish(nextWish);
      setMessage(approve ? "Price approved." : "Price rejected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to resolve price.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Wishes"
        title="Wishes and rewards"
        description="Submit wishes, negotiate point prices, redeem rewards, and track fulfillment."
      />

      <div className="summary-grid">
        <article>
          <p>Total wishes</p>
          <strong>{wishes.length}</strong>
        </article>
        <article>
          <p>Active</p>
          <strong>{stats.active}</strong>
        </article>
        <article>
          <p>Pending</p>
          <strong>{stats.pending}</strong>
        </article>
        <article>
          <p>Completed</p>
          <strong>{stats.completed}</strong>
        </article>
      </div>

      <div className="content-grid">
        <section className="panel">
          <h2>Wish list</h2>
          {loading ? <p className="muted">Loading...</p> : null}
          {message ? <p className="page-description">{message}</p> : null}
          <div className="module-list">
            {wishes.map((wish) => (
              <div className="module-row" key={wish.id}>
                <div>
                  <span>{wish.title}</span>
                  <small>
                    {wishStatusLabel(wish.status)}
                    {wish.agreedPoints ? ` · ${wish.agreedPoints} pts` : ""}
                  </small>
                  {wish.description ? <small>{wish.description}</small> : null}
                </div>

                <div className="topbar-action" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {wish.status === "submitted" ? (
                    <>
                      <button type="button" onClick={() => void mutateWish(wish, "accept")}>
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => void mutateWish(wish, "reject")}
                        style={{ background: "var(--danger)" }}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}

                  {wish.status === "pricing" || wish.status === "active" ? (
                    <>
                      <input
                        min={0}
                        type="number"
                        value={proposalPoints[wish.id] ?? wish.agreedPoints ?? 100}
                        onChange={(event) =>
                          setProposalPoints((current) => ({
                            ...current,
                            [wish.id]: Number(event.target.value)
                          }))
                        }
                        style={{ maxWidth: 96 }}
                      />
                      <button type="button" onClick={() => void proposePrice(wish)}>
                        Propose
                      </button>
                    </>
                  ) : null}

                  {wish.status === "price_pending_requester" || wish.status === "price_change_pending" ? (
                    <>
                      <button type="button" onClick={() => void resolvePrice(wish, true)}>
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void resolvePrice(wish, false)}
                        style={{ background: "var(--danger)" }}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}

                  {wish.status === "active" ? (
                    <button type="button" onClick={() => void mutateWish(wish, "redeem")}>
                      Redeem
                    </button>
                  ) : null}

                  {wish.status === "redeemed_pending_fulfillment" ? (
                    <button type="button" onClick={() => void mutateWish(wish, "complete")}>
                      Mark fulfilled
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Create wish</h2>
          <form className="module-list" onSubmit={(event) => void createWish(event)}>
            <label>
              <small>Wish title</small>
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <small>Description</small>
              <input value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label>
              <small>Fulfiller ID</small>
              <input value={fulfillerId} onChange={(event) => setFulfillerId(event.target.value)} />
            </label>
            <button type="submit">Create wish</button>
          </form>
        </section>
      </div>
    </>
  );
}
