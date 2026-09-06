import { CheckCircle2 } from "lucide-react";
import type { ValidationReport } from "../../types/domain";

export function ValidationIssues({ report }: { report: ValidationReport }) {
  if (report.valid) return <div className="success-panel"><CheckCircle2 size={18} />
    JSON satisfies the selected schema.</div>;
  return <div className="validation-issues" role="status">
    <strong>{report.error_count ?? report.errors.length} validation issue(s)</strong>
    {report.errors.map((error, index) => <div className="validation-issue" key={error.path + index}>
      <div><code>{error.path || "$"}</code><span className="badge danger">{error.validator}</span></div>
      <p>{error.message}</p>
      <small>Expected: <code>{JSON.stringify(error.expected)}</code></small>
      <small>Received ({error.received_type}): <code>{JSON.stringify(error.received)}</code></small>
    </div>)}
  </div>;
}
