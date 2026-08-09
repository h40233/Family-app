import { listAdminAdPlacements } from "@/server/admin";
import { getFamilyPlanStatus } from "@/server/plans";
import type { AdPlacementId, FamilyAd } from "./types";

const adminPlacementByFamilyPlacement: Record<AdPlacementId, string> = {
  "dashboard-feed": "dashboard-banner",
  "reports-bottom": "reports-inline",
  "route-change": "route-interstitial"
};

const adCopy: Record<AdPlacementId, Omit<FamilyAd, "placement" | "label">> = {
  "dashboard-feed": {
    title: "升級後可移除廣告",
    body: "付費家庭可使用匯出、長期歷史與進階報表，並移除廣告。",
    action: "升級",
    actionUrl: "/billing"
  },
  "reports-bottom": {
    title: "解鎖完整報表",
    body: "升級 Family Plus 後可匯出 CSV / Excel，並保留更長的家庭財務歷史。",
    action: "查看方案",
    actionUrl: "/billing"
  },
  "route-change": {
    title: "免費方案提示",
    body: "升級 Family Plus 後可移除家庭 App 內的切頁廣告。",
    action: "查看方案",
    actionUrl: "/billing"
  }
};

export async function getFamilyAdPlacement(input: {
  familyId: string;
  placement: string;
}): Promise<FamilyAd | null> {
  const placement = toAdPlacementId(input.placement);
  if (!placement) return null;

  const plan = await getFamilyPlanStatus(input.familyId);
  if (!plan.limits.hasAds) return null;

  const adminPlacementId = adminPlacementByFamilyPlacement[placement];
  const adminPlacement = (await listAdminAdPlacements()).find(
    (item) => item.id === adminPlacementId
  );

  if (!adminPlacement?.enabled) return null;

  return {
    placement,
    label: adminPlacement.label,
    ...adCopy[placement]
  };
}

function toAdPlacementId(value: string): AdPlacementId | null {
  if (
    value === "dashboard-feed" ||
    value === "reports-bottom" ||
    value === "route-change"
  ) {
    return value;
  }

  return null;
}
