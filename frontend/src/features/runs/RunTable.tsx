import { Link } from "react-router-dom";
import type { Run } from "../../types/domain";
import { Status, Progress } from "../../components/Status";
import { Empty } from "../../components/Feedback";
import { dateTime, title } from "../../utils/format";

export function RunTable({ runs, projectId, emptyAction }: {
  runs: Run[];
  projectId: string;
  emptyAction?: React.ReactNode;
}) {
  if (!runs.length) {
    return <Empty title="No extraction runs yet"
      description="Start a run to compare providers against your schema and trusted annotations."
      action={emptyAction} />;
  }
  return <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th scope="col">Run</th>
          <th scope="col">Provider</th>
          <th scope="col">Status</th>
          <th scope="col">Progress</th>
          <th scope="col">Started</th>
        </tr>
      </thead>
      <tbody>
        {runs.map(run => <tr key={run.id}>
          <td>
            <Link className="table-title" to={"/projects/" + projectId + "/runs/" + run.id}>
              {run.name}
            </Link>
            <div className="small-mark">{run.total_documents} documents</div>
          </td>
          <td>
            {title(run.provider_snapshot.provider)}
            <div className="small-mark">{run.provider_snapshot.model}</div>
          </td>
          <td><Status value={run.status} /></td>
          <td>
            <Progress completed={run.completed_documents} failed={run.failed_documents}
              total={run.total_documents} />
          </td>
          <td className="small-mark">{dateTime(run.started_at ?? run.created_at)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
