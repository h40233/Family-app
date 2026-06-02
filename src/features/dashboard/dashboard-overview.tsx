import { PageHeader } from "@/components/app-shell/page-header";
import { AdPlacement } from "@/components/billing/ad-placement";
import { Can } from "@/components/permissions/can";
import { LiveDashboardData } from "./live-dashboard-data";

export function DashboardOverview() {
  return (
    <>
      <PageHeader
        eyebrow="家庭首頁"
        title="家庭總覽"
        description="集中查看記帳、共用基金、任務、點數、願望與即時後端資料。"
        action={
          <Can permission="personal.transactions.create">
            <button type="button">新增交易</button>
          </Can>
        }
      />

      <LiveDashboardData />
      <AdPlacement placement="dashboard-feed" />
    </>
  );
}
