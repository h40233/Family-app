import { PageHeader } from "@/components/app-shell/page-header";
import { Can } from "@/components/permissions/can";

type Metric = {
  label: string;
  value: string;
};

type ModulePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionPermission?: string;
  metrics: Metric[];
  sections: string[];
};

export function ModulePage({
  eyebrow,
  title,
  description,
  actionLabel,
  actionPermission,
  metrics,
  sections
}: ModulePageProps) {
  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={
          actionLabel && actionPermission ? (
            <Can permission={actionPermission}>
              <button type="button">{actionLabel}</button>
            </Can>
          ) : null
        }
      />

      <div className="summary-grid">
        {metrics.map((metric) => (
          <article key={metric.label}>
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>

      <section className="panel">
        <h2>功能入口</h2>
        <div className="module-list">
          {sections.map((section) => (
            <div key={section} className="module-row">
              <span>{section}</span>
              <small>等待串接 API 與完整互動</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
