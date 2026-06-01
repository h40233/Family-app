import { PageHeader } from "@/components/app-shell/page-header";
import { AdPlacement } from "@/components/billing/ad-placement";
import { Can } from "@/components/permissions/can";
import { LiveDashboardData } from "./live-dashboard-data";

const summaryCards = [
  { label: "Personal net worth", value: "$128,400" },
  { label: "Shared fund balance", value: "$42,000" },
  { label: "Open tasks", value: "7" },
  { label: "Family points", value: "1,280" }
];

const taskPreview = [
  { title: "Take out trash", meta: "10 points, auto approval" },
  { title: "Water balcony plants", meta: "20 points, review required" },
  { title: "Log breakfast spending", meta: "Personal accounting" }
];

export function DashboardOverview() {
  return (
    <>
      <PageHeader
        eyebrow="Family Home"
        title="Household Command Center"
        description="A single place to scan money, shared funds, chores, points, wishes, and live MVP backend data."
        action={
          <Can permission="personal.transactions.create">
            <button type="button">Add transaction</button>
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
          <h2>Today&apos;s Tasks</h2>
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
          <h2>Wish Progress</h2>
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
