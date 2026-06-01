"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ApiEnvelope<T> = { data: T };
type FamiliesResponse = { families: Array<{ id: string; name: string }> };
type PlanStatus = { limits: { hasAds: boolean } };

export function InterstitialAd() {
  const pathname = usePathname();
  const firstPath = useRef(pathname);
  const [hasAds, setHasAds] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      const families = await fetchData<FamiliesResponse>("/api/v1/families");
      const family = families.families[0];
      if (!family) return;
      const plan = await fetchData<PlanStatus>(
        `/api/v1/families/${family.id}/plan/limits`
      );
      if (!cancelled) setHasAds(plan.limits.hasAds);
    }

    void loadPlan().catch(() => {
      if (!cancelled) setHasAds(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasAds || pathname === firstPath.current) return;

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(timer);
  }, [hasAds, pathname]);

  if (!visible) return null;

  return (
    <div className="interstitial-ad" role="status" aria-live="polite">
      <div>
        <span className="ad-label">Sponsored</span>
        <strong>Free plan message</strong>
        <p>Upgrade to Family Plus to remove interstitials across the household app.</p>
        <a href="/billing">View plan</a>
      </div>
    </div>
  );
}

async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) throw new Error("Request failed.");
  return body.data;
}
