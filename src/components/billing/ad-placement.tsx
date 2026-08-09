"use client";

import { useEffect, useState } from "react";

type Placement = "dashboard-feed" | "reports-bottom";
type ApiEnvelope<T> = { data?: T; error?: { message?: string } };
type FamiliesResponse = { families: Array<{ id: string; name: string }> };
type FamilyAd = {
  placement: Placement;
  label: string;
  title: string;
  body: string;
  action: string;
  actionUrl: string;
};

export function AdPlacement({ placement }: { placement: Placement }) {
  const [ad, setAd] = useState<FamilyAd | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const families = await fetchData<FamiliesResponse>("/api/v1/families");
      const family = families.families[0];
      if (!family) return;

      const response = await fetchData<{ ad: FamilyAd | null }>(
        `/api/v1/families/${family.id}/ads?placement=${encodeURIComponent(placement)}`
      );
      if (!cancelled) setAd(response.ad);
    }

    void load().catch(() => {
      if (!cancelled) setAd(null);
    });

    return () => {
      cancelled = true;
    };
  }, [placement]);

  if (!ad) return null;

  return (
    <aside className={`ad-placement ad-placement-${placement}`} aria-label="贊助內容">
      <div>
        <span className="ad-label">{ad.label}</span>
        <strong>{ad.title}</strong>
        <p>{ad.body}</p>
      </div>
      <a href={ad.actionUrl}>{ad.action}</a>
    </aside>
  );
}

async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? "請求失敗。");
  }

  return body.data as T;
}
