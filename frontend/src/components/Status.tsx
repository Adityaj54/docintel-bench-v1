import { title } from "../utils/format";

const tones: Record<string, string> = {
  completed: "success",
  ready: "success",
  active: "success",
  delivered: "success",
  match: "success",
  failed: "danger",
  missing: "danger",
  type_mismatch: "danger",
  partially_failed: "warning",
  changed: "warning",
  extra: "warning",
  running: "info",
  processing: "info",
  extracting: "info",
  evaluating: "info",
  validating: "info",
  retrying: "warning",
};

export function Status({ value }: { value: string }) {
  return <span className={"badge " + (tones[value] ?? "neutral")}>
    <span className="badge-dot" />{title(value)}
  </span>;
}

export function Progress({ completed, failed, total }: {
  completed: number;
  failed: number;
  total: number;
}) {
  const done = completed + failed;
  return <div className="progress-block">
    <div className="progress-label"><span>{done} / {total} processed</span>
      <span>{total ? Math.round(done / total * 100) : 0}%</span>
    </div>
    <div className="progress" role="progressbar" aria-valuemin={0}
      aria-valuemax={total} aria-valuenow={done} aria-label="Run progress">
      <div className="progress-success" style={{ width: (total ? completed / total * 100 : 0) + "%" }} />
      <div className="progress-failure" style={{ width: (total ? failed / total * 100 : 0) + "%" }} />
    </div>
  </div>;
}
