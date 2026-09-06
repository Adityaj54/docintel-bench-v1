import { useMemo, useState } from "react";
import type { Difference, Json } from "../../types/domain";
import { Status } from "../../components/Status";
import { Empty } from "../../components/Feedback";

const order: Difference["status"][] = ["missing", "type_mismatch", "changed", "extra", "match"];

function preview(value: Json, present: boolean) {
  if (!present) return <span className="json-null">absent</span>;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text === undefined) return <span className="json-null">null</span>;
  return <span className="hash-line">{text.length > 120 ? text.slice(0, 120) + "…" : text}</span>;
}

export function Differences({ differences }: { differences: Difference[] }) {
  const [showMatches, setShowMatches] = useState(false);

  const counts = useMemo(() => {
    const totals = {} as Record<Difference["status"], number>;
    for (const row of differences) totals[row.status] = (totals[row.status] ?? 0) + 1;
    return totals;
  }, [differences]);

  const visible = useMemo(() => {
    const rows = showMatches ? differences : differences.filter(row => row.status !== "match");
    return [...rows].sort((left, right) =>
      order.indexOf(left.status) - order.indexOf(right.status) || left.path.localeCompare(right.path));
  }, [differences, showMatches]);

  if (!differences.length) {
    return <Empty title="Nothing to compare"
      description="Add trusted ground truth for this document to score the extraction." />;
  }

  return <>
    <div className="panel-body" style={{ paddingBottom: 12 }}>
      <div className="toolbar" style={{ marginBottom: 0 }}>
        {order.filter(status => counts[status]).map(status => <span key={status}>
          <Status value={status} /> <span className="small-mark">{counts[status]}</span>
        </span>)}
        <label className="field inline" style={{ marginLeft: "auto", marginBottom: 0 }}>
          <input type="checkbox" checked={showMatches}
            onChange={event => setShowMatches(event.target.checked)} />
          <span>Show matching fields</span>
        </label>
      </div>
    </div>
    {!visible.length
      ? <Empty title="Every field matched" description="The extraction agrees with the trusted values." />
      : <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Result</th>
              <th scope="col">Expected</th>
              <th scope="col">Extracted</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => <tr key={row.path + ":" + row.actual_path + ":" + index}>
              <td>
                <span className="hash-line">{row.path}</span>
                {row.actual_path !== row.path &&
                  <div className="small-mark">matched against {row.actual_path}</div>}
              </td>
              <td><Status value={row.status} /></td>
              <td>{preview(row.expected, row.expected_present)}
                <div className="small-mark">{row.expected_type}</div></td>
              <td>{preview(row.actual, row.actual_present)}
                <div className="small-mark">{row.actual_type}</div></td>
            </tr>)}
          </tbody>
        </table>
      </div>}
  </>;
}
