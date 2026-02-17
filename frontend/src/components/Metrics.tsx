import type { ReactNode } from "react";
import { count, latency, money, percent } from "../utils/format";
import type { MetricSummary } from "../types/domain";
import { CheckCheck, Clock3, FileText, Gauge, Layers, Wallet } from "lucide-react";

export function MetricCard({ label, value, detail, icon }: {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
}) {
  return <div className="metric-card">
    <div className="metric-label">{label}{icon}</div>
    <div className="metric-value">{value}</div>
    {detail && <div className="metric-detail">{detail}</div>}
  </div>;
}

export function SummaryCards({ summary }: { summary: MetricSummary }) {
  return <div className="metric-grid">
    <MetricCard label="Documents" value={count(summary.document_count)} icon={<FileText size={17} />}
      detail={count(summary.extraction_count) + " extractions"} />
    <MetricCard label="Completed runs" value={count(summary.successful_runs)} icon={<Layers size={17} />}
      detail={count(summary.failed_runs) + " runs with failures"} />
    <MetricCard label="Schema validity" value={percent(summary.validation_success_rate)}
      detail="Of validated results" icon={<CheckCheck size={17} />} />
    <MetricCard label="Evaluation score" value={percent(summary.average_evaluation_score)}
      detail="Against trusted annotations" icon={<Gauge size={17} />} />
    <MetricCard label="Average latency" value={latency(summary.average_latency_ms)}
      detail={"p95 " + latency(summary.p95_latency_ms)} icon={<Clock3 size={17} />} />
    <MetricCard label="Provider cost" value={money(summary.estimated_total_cost)}
      detail="Estimated from configured rates" icon={<Wallet size={17} />} />
  </div>;
}
