import { useState } from "react";
import { Link } from "react-router-dom";
import { GitCompareArrows } from "lucide-react";
import { ErrorPanel, Empty, Loading, PageHeader, Section } from "../../components/Feedback";
import { Status } from "../../components/Status";
import { useResource } from "../../hooks/useResource";
import { useProject } from "../../layouts/Workspace";
import type { Page, ProviderMetric, Run, RunComparison } from "../../types/domain";
import { count, dateTime, latency, money, percent, title } from "../../utils/format";

type Row = {
  key: keyof ProviderMetric;
  label: string;
  render: (metric: ProviderMetric) => string;
  better?: "high" | "low";
};

const rows: Row[] = [
  { key: "total", label: "Results", render: metric => count(metric.total) },
  { key: "success_rate", label: "Success rate", render: metric => percent(metric.success_rate), better: "high" },
  { key: "validity_rate", label: "Schema valid", render: metric => percent(metric.validity_rate), better: "high" },
  { key: "average_score", label: "Evaluation score", render: metric => percent(metric.average_score), better: "high" },
  { key: "average_latency_ms", label: "Average latency", render: metric => latency(metric.average_latency_ms), better: "low" },
  { key: "p95_latency_ms", label: "p95 latency", render: metric => latency(metric.p95_latency_ms), better: "low" },
  { key: "cost_per_document", label: "Cost per document", render: metric => money(metric.cost_per_document), better: "low" },
  { key: "total_cost", label: "Total cost", render: metric => money(metric.total_cost), better: "low" },
  { key: "failures", label: "Failures", render: metric => count(metric.failures), better: "low" },
];

function leaders(comparisons: RunComparison[], row: Row): Set<string> {
  if (!row.better) return new Set();
  const values = comparisons
    .map(item => ({ id: item.run_id, value: item.metrics[row.key] }))
    .filter((item): item is { id: string; value: number } => typeof item.value === "number");
  if (values.length < 2) return new Set();
  const best = row.better === "high"
    ? Math.max(...values.map(item => item.value))
    : Math.min(...values.map(item => item.value));
  return new Set(values.filter(item => item.value === best).map(item => item.id));
}

export function ComparePage() {
  const { project } = useProject();
  const [selected, setSelected] = useState<string[]>([]);
  const runs = useResource<Page<Run>>("/projects/" + project.id + "/runs?limit=50");
  const parameters = selected.map(id => "run_ids=" + encodeURIComponent(id)).join("&");
  const comparison = useResource<RunComparison[]>(
    selected.length >= 2 ? "/projects/" + project.id + "/comparison?" + parameters : null);

  function toggle(id: string) {
    setSelected(previous => previous.includes(id)
      ? previous.filter(value => value !== id)
      : previous.length >= 8 ? previous : [...previous, id]);
  }

  return <>
    <PageHeader eyebrow="A/B EVALUATION" title="Compare runs"
      description="Select two to eight runs to see how provider, model, and schema choices differ." />

    <ErrorPanel error={runs.error} retry={runs.refresh} />

    <Section title="Choose runs" description={selected.length + " of 8 selected"}>
      {runs.loading ? <Loading label="Loading runs…" />
        : !runs.data?.items.length
          ? <Empty title="No runs to compare"
            description="Start at least two extraction runs first."
            action={<Link className="button primary" to={"/projects/" + project.id + "/runs?new=1"}>
              New extraction</Link>} />
          : <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col"><span className="small-mark">Select</span></th>
                  <th scope="col">Run</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.data.items.map(run => {
                  const checked = selected.includes(run.id);
                  return <tr key={run.id}>
                    <td>
                      <input type="checkbox" checked={checked}
                        disabled={!checked && selected.length >= 8}
                        aria-label={"Compare " + run.name}
                        onChange={() => toggle(run.id)} />
                    </td>
                    <td>
                      <Link className="table-title" to={"/projects/" + project.id + "/runs/" + run.id}>
                        {run.name}
                      </Link>
                      <div className="small-mark">{run.total_documents} documents</div>
                    </td>
                    <td>{title(run.provider_snapshot.provider)}
                      <div className="small-mark">{run.provider_snapshot.model}</div></td>
                    <td><Status value={run.status} /></td>
                    <td className="small-mark">{dateTime(run.started_at ?? run.created_at)}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>}
    </Section>

    {selected.length < 2
      ? <Empty title="Select two runs to compare"
        description="Pick the runs you want to weigh against each other." />
      : <>
        <ErrorPanel error={comparison.error} retry={comparison.refresh} />
        {comparison.loading ? <Loading label="Comparing runs…" />
          : comparison.data && <Section title="Side by side"
            description="The strongest value in each row is highlighted."
            actions={<GitCompareArrows size={18} />}>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    {comparison.data.map(item => <th scope="col" key={item.run_id}>
                      {item.name}
                      <div className="small-mark">
                        {item.metrics.provider}/{item.metrics.model}
                      </div>
                    </th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const best = leaders(comparison.data ?? [], row);
                    return <tr key={String(row.key)}>
                      <th scope="row" style={{ textTransform: "none", letterSpacing: 0 }}>{row.label}</th>
                      {(comparison.data ?? []).map(item => <td key={item.run_id}>
                        {best.has(item.run_id)
                          ? <strong style={{ color: "var(--success)" }}>{row.render(item.metrics)}</strong>
                          : row.render(item.metrics)}
                      </td>)}
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </Section>}
      </>}
  </>;
}
