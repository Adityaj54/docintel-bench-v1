import { dateOnly } from "../utils/format";
import type { MetricReport } from "../types/domain";

export function VolumeChart({ points }: { points: MetricReport["volume"] }) {
  if (!points.length) return <p className="chart-empty">Start an extraction to see daily volume.</p>;
  const visible = points.slice(-30);
  const maximum = Math.max(...visible.map(point => point.total), 1);
  return <div className="volume-chart">
    <div className="chart-legend">
      <span><i className="legend-dot completed" />Completed</span>
      <span><i className="legend-dot failed" />Failed</span>
      <span><i className="legend-dot pending" />In progress</span>
    </div>
    <div className="chart-bars" role="img" aria-label="Daily extraction volume">
      {visible.map(point => <div className="chart-column" key={point.date}>
        <div className="bar-label">{point.total}</div>
        <div className="bar-track">
          <div className="bar-stack" style={{ height: point.total / maximum * 100 + "%" }}
            title={point.date + ": " + point.completed + " completed, " + point.failed + " failed"}>
            <div className="bar-pending" style={{
              flex: Math.max(0, point.total - point.completed - point.failed),
            }} />
            <div className="bar-failed" style={{ flex: point.failed }} />
            <div className="bar-completed" style={{ flex: point.completed }} />
          </div>
        </div>
        <div className="bar-date">{dateOnly(point.date)}</div>
      </div>)}
    </div>
  </div>;
}

export function Breakdown({ values, empty = "No data available." }: {
  values: { label: string; count: number }[];
  empty?: string;
}) {
  const total = values.reduce((sum, item) => sum + item.count, 0);
  if (!total) return <p className="chart-empty">{empty}</p>;
  return <div className="breakdown">
    {values.map(item => <div key={item.label} className="breakdown-item">
      <div><span>{item.label}</span><strong>{item.count}</strong></div>
      <div className="breakdown-track">
        <div style={{ width: item.count / total * 100 + "%" }} />
      </div>
    </div>)}
  </div>;
}
