import { useState } from "react";
import { query } from "../../api/client";
import { Breakdown, VolumeChart } from "../../components/Charts";
import { ErrorPanel, Empty, Loading, PageHeader, Section } from "../../components/Feedback";
import { SummaryCards } from "../../components/Metrics";
import { useResource } from "../../hooks/useResource";
import { useProject } from "../../layouts/Workspace";
import type { MetricReport } from "../../types/domain";
import { count, latency, money, percent, title } from "../../utils/format";

function isoStart(value: string) {
  return value ? new Date(value + "T00:00:00").toISOString() : "";
}

function isoEnd(value: string) {
  return value ? new Date(value + "T23:59:59").toISOString() : "";
}

export function MetricsPage() {
  const { project } = useProject();
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const invalid = Boolean(since && until && since > until);
  const resource = useResource<MetricReport>(invalid ? null : "/projects/" + project.id + "/metrics"
    + query({ since: isoStart(since), until: isoEnd(until) }));

  return <>
    <PageHeader eyebrow="QUALITY, SPEED, COST" title="Metrics"
      description="Aggregated across every extraction result in this project." />

    <div className="toolbar">
      <label className="field inline">
        <span>From</span>
        <input type="date" value={since} onChange={event => setSince(event.target.value)} />
      </label>
      <label className="field inline">
        <span>To</span>
        <input type="date" value={until} onChange={event => setUntil(event.target.value)} />
      </label>
      {(since || until) && <button className="button secondary small"
        onClick={() => { setSince(""); setUntil(""); }}>Clear</button>}
    </div>

    {invalid && <ErrorPanel error="The start date must come before the end date." />}
    <ErrorPanel error={resource.error} retry={resource.refresh} />

    {resource.loading ? <Loading label="Calculating metrics…" /> : resource.data && <>
      <SummaryCards summary={resource.data.summary} />

      <div className="dashboard-charts">
        <Section title="Daily volume" description="Completed and failed extractions per day">
          <VolumeChart points={resource.data.volume} />
        </Section>
        <Section title="Failure reasons" description="Grouped by error code">
          <Breakdown values={resource.data.errors} empty="No failures recorded in this period." />
        </Section>
      </div>

      <Section title="Provider comparison"
        description="Every provider and model that has produced a result in this project.">
        {!resource.data.providers.length
          ? <Empty title="No provider results yet"
            description="Start an extraction run to populate this comparison." />
          : <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Provider</th>
                  <th scope="col">Results</th>
                  <th scope="col">Success</th>
                  <th scope="col">Schema valid</th>
                  <th scope="col">Score</th>
                  <th scope="col">p50</th>
                  <th scope="col">p95</th>
                  <th scope="col">Cost / doc</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {resource.data.providers.map(row => <tr key={row.provider + "/" + row.model}>
                  <td>
                    <strong>{title(row.provider)}</strong>
                    <div className="small-mark">{row.model}</div>
                  </td>
                  <td>{count(row.total)}</td>
                  <td>{percent(row.success_rate)}
                    {row.failures > 0 && <div className="small-mark">{row.failures} failed</div>}</td>
                  <td>{percent(row.validity_rate)}</td>
                  <td>{percent(row.average_score)}</td>
                  <td>{latency(row.p50_latency_ms)}</td>
                  <td>{latency(row.p95_latency_ms)}</td>
                  <td>{money(row.cost_per_document)}</td>
                  <td>{money(row.total_cost)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>}
      </Section>

      <Section title="Document mix" description="File types across active datasets">
        <div className="panel-body">
          <Breakdown values={resource.data.mime_types} empty="Upload documents to see the mix." />
        </div>
      </Section>
    </>}
  </>;
}
