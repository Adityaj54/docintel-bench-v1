import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Ban, Download } from "lucide-react";
import { download, post, query } from "../../api/client";
import { ErrorPanel, Empty, Loading, PageHeader, Section } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import { Progress, Status } from "../../components/Status";
import { useToast } from "../../components/Toast";
import { useMutation } from "../../hooks/useMutation";
import { useResource } from "../../hooks/useResource";
import { useProject } from "../../layouts/Workspace";
import type { Page, Result, Run } from "../../types/domain";
import { dateTime, latency, money, percent, terminal, title } from "../../utils/format";

export function RunDetail() {
  const { runId } = useParams();
  const { project } = useProject();
  const toast = useToast();
  const cancellation = useMutation();
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("");
  const limit = 25;
  const run = useResource<Run>("/runs/" + runId, 4000);
  const finished = run.data ? terminal(run.data.status) : false;
  const results = useResource<Page<Result>>(
    "/runs/" + runId + "/results" + query({ status, offset, limit }),
    finished ? 0 : 4000,
  );

  if (run.loading) return <Loading label="Loading run…" />;
  if (run.error) return <ErrorPanel error={run.error} retry={run.refresh} />;
  if (!run.data) return null;

  const detail = run.data;
  const snapshot = detail.provider_snapshot;

  async function cancel() {
    const updated = await cancellation.execute(() => post<Run>("/runs/" + runId + "/cancel"));
    if (updated) {
      toast("Run cancelled. Documents already finished keep their results.");
      run.refresh();
      results.refresh();
    }
  }

  return <>
    <PageHeader eyebrow="EXTRACTION RUN" title={detail.name}
      description={"Started " + dateTime(detail.started_at ?? detail.created_at)}
      actions={<>
        {!finished && <button className="button secondary" disabled={cancellation.pending} onClick={() => void cancel()}>
          <Ban size={16} />Cancel run
        </button>}
        <button className="button secondary"
          onClick={() => void download("/runs/" + detail.id + "/export?format=csv", "run-" + detail.id + ".csv")}>
          <Download size={16} />CSV
        </button>
        <button className="button secondary"
          onClick={() => void download("/runs/" + detail.id + "/export?format=jsonl", "run-" + detail.id + ".jsonl")}>
          <Download size={16} />JSONL
        </button>
      </>} />

    <ErrorPanel error={cancellation.error} />

    <Section title="Progress" description="Individual documents are processed independently.">
      <div className="panel-body">
        <div className="split-label" style={{ marginBottom: 14 }}>
          <Status value={detail.status} />
          <span className="small-mark">
            {detail.completed_documents} completed · {detail.failed_documents} failed
            · {detail.total_documents} total
          </span>
        </div>
        <Progress completed={detail.completed_documents} failed={detail.failed_documents}
          total={detail.total_documents} />
        <div className="document-metadata" style={{ marginTop: 18 }}>
          <div><span>Provider</span><strong>{title(snapshot.provider)} · {snapshot.model}</strong></div>
          <div><span>Configuration</span><strong>{snapshot.name}</strong></div>
          <div><span>Schema</span>
            <Link className="text-link" to={"/projects/" + project.id + "/schemas/" + detail.schema_id}>
              View definition
            </Link>
          </div>
          <div><span>Array comparison</span><strong>{title(detail.evaluation_options.array_order)}</strong></div>
          <div><span>Numeric tolerance</span><strong>{detail.evaluation_options.numeric_tolerance}</strong></div>
          <div><span>Finished</span><strong>{dateTime(detail.finished_at)}</strong></div>
        </div>
      </div>
    </Section>

    <Section title="Documents" description="Open a document to inspect the output and its differences.">
      <div className="panel-body" style={{ paddingBottom: 0 }}>
        <label className="field inline">
          <span>Status</span>
          <select value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}>
            <option value="">All</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="queued">Queued</option>
          </select>
        </label>
      </div>
      <ErrorPanel error={results.error} retry={results.refresh} />
      {results.loading ? <Loading label="Loading documents…" />
        : !results.data?.items.length
          ? <Empty title="No documents match" description="Change the status filter to see more." />
          : <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Document</th>
                    <th scope="col">Status</th>
                    <th scope="col">Schema</th>
                    <th scope="col">Score</th>
                    <th scope="col">Latency</th>
                    <th scope="col">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {results.data.items.map(result => <tr key={result.id}>
                    <td>
                      <Link className="table-title" to={"/projects/" + project.id + "/results/" + result.id}>
                        {result.document_name}
                      </Link>
                      {result.error && <div className="small-mark">{result.error.code}</div>}
                    </td>
                    <td><Status value={result.status} /></td>
                    <td>{result.validation
                      ? <Status value={result.validation.valid ? "completed" : "failed"} />
                      : <span className="small-mark">—</span>}</td>
                    <td>{percent(result.evaluation?.score ?? null)}</td>
                    <td>{latency(result.latency_ms)}</td>
                    <td>{money(result.estimated_cost)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <Pagination total={results.data.total} offset={offset} limit={limit} onChange={setOffset} />
          </>}
    </Section>
  </>;
}
