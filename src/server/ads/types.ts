export type AdPlacementId = "dashboard-feed" | "reports-bottom" | "route-change";

export type FamilyAd = {
  placement: AdPlacementId;
  label: string;
  title: string;
  body: string;
  action: string;
  actionUrl: string;
};
