import { PageHeader } from "@/components/app-shell/page-header";
import { AdPlacement } from "@/components/billing/ad-placement";
import { Can } from "@/components/permissions/can";
import { LiveDashboardData } from "./live-dashboard-data";

const summaryCards = [
  { label: "個人總資產", value: "$128,400" },
  { label: "共用基金餘額", value: "$42,000" },
  { label: "待完成任務", value: "7" },
  { label: "家庭點數", value: "1,280" }
];

const taskPreview = [
  { title: "倒垃圾", meta: "10 點，自動發放" },
  { title: "澆陽台植物", meta: "20 點，需要審核" },
  { title: "記錄早餐支出", meta: "個人記帳" }
];

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

      <div className="summary-grid">
        {summaryCards.map((card) => (
          <article key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="content-grid">
        <section className="panel">
          <h2>今日任務</h2>
          <ul className="task-list">
            {taskPreview.map((task) => (
              <li key={task.title}>
                <span>{task.title}</span>
                <small>{task.meta}</small>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>願望進度</h2>
          <div className="wish-card">
            <span>RTX 5090</span>
            <strong>1280 / 50000</strong>
            <div className="progress" aria-label="Wish progress 3%">
              <span style={{ width: "3%" }} />
            </div>
          </div>
        </section>
      </div>

      <AdPlacement placement="dashboard-feed" />
      <LiveDashboardData />
    </>
  );
}
