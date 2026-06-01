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
    title: "升級後可移除廣告",
    body: "讓任務、點數、記帳與願望管理保持更安靜的使用體驗。",
    action: "升級"
  },
  "reports-bottom": {
    title: "解鎖完整報表",
    body: "付費家庭可使用匯出、長期歷史、進階報表，並移除廣告。",
    action: "查看方案"
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
    <aside className={`ad-placement ad-placement-${placement}`} aria-label="贊助內容">
      <div>
        <span className="ad-label">贊助內容</span>
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
  if (!response.ok) throw new Error("請求失敗。");
  return body.data;
}
