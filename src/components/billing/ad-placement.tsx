"use client";

import { useEffect, useState } from "react";

type Placement = "dashboard-feed" | "reports-bottom";
type ApiEnvelope<T> = { data: T };
type FamiliesResponse = { families: Array<{ id: string; name: string }> };
type PlanStatus = {
  plan: "free" | "paid";
  limits: { hasAds: boolean };
};

const placementCopy: Record<Placement, { title: string; body: string; action: string }> = {
  "dashboard-feed": {
    title: "Family Plus removes ads",
    body: "Keep chores, points, money, and wishes in one quieter workspace.",
    action: "Upgrade"
  },
  "reports-bottom": {
    title: "Unlock clean reports",
    body: "Paid families get exports, longer history, advanced reports, and no ad placements.",
    action: "View plan"
  }
};

export function AdPlacement({ placement }: { placement: Placement }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const families = await fetchData<FamiliesResponse>("/api/v1/families");
      const family = families.families[0];
      if (!family) return;

      const plan = await fetchData<PlanStatus>(
        `/api/v1/families/${family.id}/plan/limits`
      );
      if (!cancelled) setVisible(plan.limits.hasAds);
    }

    void load().catch(() => {
      if (!cancelled) setVisible(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  const copy = placementCopy[placement];

  return (
    <aside className={`ad-placement ad-placement-${placement}`} aria-label="Sponsored">
      <div>
        <span className="ad-label">Sponsored</span>
        <strong>{copy.title}</strong>
        <p>{copy.body}</p>
      </div>
      <a href="/billing">{copy.action}</a>
    </aside>
  );
}

async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error("Request failed.");
  return body.data;
}
