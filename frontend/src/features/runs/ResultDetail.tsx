import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BadgeCheck } from "lucide-react";
import { post } from "../../api/client";
import { ErrorPanel, Loading, PageHeader, Section } from "../../components/Feedback";
import { JsonTree } from "../../components/JsonTree";
import { MetricCard } from "../../components/Metrics";
import { Status } from "../../components/Status";
import { useToast } from "../../components/Toast";
import { useMutation } from "../../hooks/useMutation";
import { useResource } from "../../hooks/useResource";
import { useProject } from "../../layouts/Workspace";
import type { GroundTruth, Result } from "../../types/domain";
import { count, latency, money, percent, title } from "../../utils/format";
import { ValidationIssues } from "../schemas/ValidationIssues";
import { Differences } from "./Differences";

export function ResultDetail() {
  const { resultId } = useParams();
  const { project } = useProject();
  const toast = useToast();
  const promotion = useMutation();
  const resource = useResource<Result>("/results/" + resultId, 4000);

  if (resource.loading) return <Loading label="Loading extraction result…" />;
  if (resource.error) return <ErrorPanel error={resource.error} retry={resource.refresh} />;
  if (!resource.data) return null;

  const result = resource.data;

  async function promote() {
    const saved = await promotion.execute(() =>
      post<GroundTruth>("/results/" + resultId + "/promote", {}));
    if (saved) {
      toast("Saved as ground truth version " + saved.version + ".");
      resource.refresh();
    }
  }

  return <>
    <PageHeader eyebrow="EXTRACTION RESULT" title={result.document_name}
      description={title(result.provider) + " · " + result.model + " · attempt " + result.attempts}
      actions={<>
        <Link className="button secondary" to={"/projects/" + project.id + "/runs/" + result.run_id}>
          <ArrowLeft size={16} />Back to run
        </Link>
        <Link className="button secondary" to={"/projects/" + project.id + "/documents/" + result.document_id}>
          Open document
        </Link>
        {result.status === "completed" && result.output !== null &&
          <button className="button primary" disabled={promotion.pending} onClick={() => void promote()}>
            <BadgeCheck size={16} />Use as ground truth
          </button>}
      </>} />

    <ErrorPanel error={promotion.error} />

    {result.error && <div className="error-panel" role="alert">
      <AlertTriangle size={20} />
      <div>
        <strong>{result.error.code}</strong>
        <p>{result.error.message}</p>
      </div>
    </div>}

    <div className="metric-grid">
      <MetricCard label="Status" value={title(result.status)} />
      <MetricCard label="Evaluation" value={percent(result.evaluation?.score ?? null)}
        detail={result.evaluation
          ? result.evaluation.matched_fields + " of " + result.evaluation.total_fields + " fields"
          : "No ground truth"} />
      <MetricCard label="Latency" value={latency(result.latency_ms)} />
      <MetricCard label="Tokens" value={count(result.input_tokens + result.output_tokens)}
        detail={count(result.input_tokens) + " in · " + count(result.output_tokens) + " out"} />
      <MetricCard label="Cost" value={money(result.estimated_cost)} detail="Estimated" />
    </div>

    {result.normalization_warnings.length > 0 && <div className="notice">
      <AlertTriangle size={20} />
      <div>
        <strong>Provider output was normalised before validation</strong>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {result.normalization_warnings.map((warning, index) =>
            <li key={index}><code>{warning.path}</code> — {warning.message}</li>)}
        </ul>
      </div>
    </div>}

    {result.evaluation && <Section title="Differences from ground truth"
      description={"Scored against version " + result.evaluation.ground_truth_version
        + " · precision " + percent(result.evaluation.precision)
        + " · recall " + percent(result.evaluation.recall)
        + " · F1 " + percent(result.evaluation.f1)}>
      <Differences differences={result.evaluation.differences} />
    </Section>}

    {result.validation && <Section title="Schema validation"
      description={result.validation.valid
        ? "The output satisfies the schema version used by this run."
        : result.validation.errors.length + " violation(s) found."}
      actions={<Status value={result.validation.valid ? "completed" : "failed"} />}>
      <div className="panel-body">
        {result.validation.valid
          ? <p className="muted">No violations.</p>
          : <ValidationIssues report={result.validation} />}
      </div>
    </Section>}

    <Section title="Extracted output" description="Normalised JSON that was validated and scored.">
      <div className="panel-body">
        <JsonTree value={result.output} title="Extracted output" />
      </div>
    </Section>

    {result.raw_response && <Section title="Raw provider response"
      description="Preserved exactly as returned, before normalisation.">
      <div className="panel-body">
        <JsonTree value={result.raw_response} title="Raw provider response" />
      </div>
    </Section>}
  </>;
}
