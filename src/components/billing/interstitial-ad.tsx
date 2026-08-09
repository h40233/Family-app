"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ApiEnvelope<T> = { data?: T; error?: { message?: string } };
type FamiliesResponse = { families: Array<{ id: string; name: string }> };
type FamilyAd = {
  label: string;
  title: string;
  body: string;
  action: string;
  actionUrl: string;
};

export function InterstitialAd() {
  const pathname = usePathname();
  const firstPath = useRef(pathname);
  const [ad, setAd] = useState<FamilyAd | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAd() {
      const families = await fetchData<FamiliesResponse>("/api/v1/families");
      const family = families.families[0];
      if (!family) return;
      const response = await fetchData<{ ad: FamilyAd | null }>(
        `/api/v1/families/${family.id}/ads?placement=route-change`
      );
      if (!cancelled) setAd(response.ad);
    }

    void loadAd().catch(() => {
      if (!cancelled) setAd(null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ad || pathname === firstPath.current) return;

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, [ad, pathname]);

  if (!visible || !ad) return null;

  return (
    <div className="interstitial-ad" role="status" aria-live="polite">
      <div>
        <span className="ad-label">{ad.label}</span>
        <strong>{ad.title}</strong>
        <p>{ad.body}</p>
        <a href={ad.actionUrl}>{ad.action}</a>
      </div>
    </div>
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
