import { Empty, Section } from "../../components/Feedback";
import type { MetricSignificance, RunSignificance } from "../../types/domain";
import { count, latency, money, percent } from "../../utils/format";

const formatters: Record<string, (value: number) => string> = {
  average_score: percent,
  validity_rate: percent,
  success_rate: percent,
  average_latency_ms: latency,
  cost_per_document: money,
};

const tones: Record<MetricSignificance["verdict"], string> = {
  better: "success",
  worse: "danger",
  inconclusive: "neutral",
};

const labels: Record<MetricSignificance["verdict"], string> = {
  better: "Better",
  worse: "Worse",
  inconclusive: "No difference detected",
};

function format(metric: MetricSignificance, value: number) {
  return (formatters[metric.metric] ?? String)(value);
}

function evidence(metric: MetricSignificance) {
  const adjusted = metric.adjusted_p_value;
  return (adjusted < 0.001 ? "p < 0.001" : "p = " + adjusted.toFixed(3))
    + (metric.exact ? " exact" : " sampled");
}

export function Significance({ comparisons }: { comparisons: RunSignificance[] }) {
  return <>
    {comparisons.map(comparison => <Section key={comparison.run_id}
      title={comparison.name + " vs " + comparison.baseline_name}
      description={count(comparison.paired_documents) + " documents ran through both · "
        + "differences paired per document, " + percent(comparison.metrics[0]?.confidence ?? 0.95)
        + " confidence, Holm-adjusted across " + comparison.metrics.length + " metrics"}>
      {!comparison.metrics.length
        ? <Empty title="Nothing to pair"
          description="These runs share no documents with a measured result, so no difference can be tested." />
        : <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">{comparison.baseline_name}</th>
                <th scope="col">{comparison.name}</th>
                <th scope="col">Difference</th>
                <th scope="col">Evidence</th>
                <th scope="col">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {comparison.metrics.map(metric => <tr key={metric.metric}>
                <th scope="row" style={{ textTransform: "none", letterSpacing: 0 }}>
                  {metric.label}
                  <div className="small-mark">
                    {metric.direction === "higher" ? "higher is better" : "lower is better"}
                  </div>
                </th>
                <td>{format(metric, metric.baseline_mean)}</td>
                <td>{format(metric, metric.candidate_mean)}</td>
                <td>
                  {format(metric, metric.difference)}
                  <div className="small-mark">
                    {format(metric, metric.confidence_low)} to {format(metric, metric.confidence_high)}
                  </div>
                </td>
                <td className="small-mark">
                  {evidence(metric)}
                  {metric.verdict === "inconclusive" && metric.minimum_detectable_effect !== null
                    && <div>
                      {metric.pairs} documents could only detect {format(metric, metric.minimum_detectable_effect)}
                    </div>}
                </td>
                <td><span className={"badge " + tones[metric.verdict]}>
                  <span className="badge-dot" />{labels[metric.verdict]}
                </span></td>
              </tr>)}
            </tbody>
          </table>
        </div>}
    </Section>)}
  </>;
}
