import { useState } from "react";
import { query } from "../../api/client";
import { ErrorPanel, Empty, Loading, PageHeader } from "../../components/Feedback";
import { JsonTree } from "../../components/JsonTree";
import { Pagination } from "../../components/Pagination";
import { useResource } from "../../hooks/useResource";
import { useProject } from "../../layouts/Workspace";
import type { Audit, Page } from "../../types/domain";
import { dateTime, shortId, title } from "../../utils/format";

const entities = ["", "project", "schema", "dataset", "document", "run", "result", "ground_truth", "webhook"];

function isoStart(value: string) {
  return value ? new Date(value + "T00:00:00").toISOString() : "";
}

function isoEnd(value: string) {
  return value ? new Date(value + "T23:59:59").toISOString() : "";
}

export function AuditPage() {
  const { project } = useProject();
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const limit = 25;
  const invalid = Boolean(since && until && since > until);

  const resource = useResource<Page<Audit>>(invalid ? null : "/projects/" + project.id + "/audit"
    + query({ action, entity, since: isoStart(since), until: isoEnd(until), offset, limit }));

  function change(setter: (value: string) => void) {
    return (value: string) => { setter(value); setOffset(0); };
  }

  return <>
    <PageHeader eyebrow="ACCOUNTABILITY" title="Audit log"
      description="Every change to schemas, datasets, documents, runs, and trusted annotations." />

    <div className="toolbar">
      <input className="search-input" placeholder="Filter by action…" value={action}
        onChange={event => change(setAction)(event.target.value)} />
      <label className="field inline">
        <span>Entity</span>
        <select value={entity} onChange={event => change(setEntity)(event.target.value)}>
          {entities.map(value => <option key={value} value={value}>
            {value ? title(value) : "All entities"}
          </option>)}
        </select>
      </label>
      <label className="field inline">
        <span>From</span>
        <input type="date" value={since} onChange={event => change(setSince)(event.target.value)} />
      </label>
      <label className="field inline">
        <span>To</span>
        <input type="date" value={until} onChange={event => change(setUntil)(event.target.value)} />
      </label>
      {(action || entity || since || until) && <button className="button secondary small"
        onClick={() => { setAction(""); setEntity(""); setSince(""); setUntil(""); setOffset(0); }}>
        Clear filters
      </button>}
    </div>

    {invalid && <ErrorPanel error="The start date must come before the end date." />}
    <ErrorPanel error={resource.error} retry={resource.refresh} />

    <section className="panel">
      {resource.loading ? <Loading label="Loading audit history…" />
        : !resource.data?.items.length
          ? <Empty title="No matching events"
            description="Adjust the filters, or make a change to see it recorded here." />
          : <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Action</th>
                    <th scope="col">Entity</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.items.map(event => <tr key={event.id}>
                    <td className="small-mark">{dateTime(event.created_at)}</td>
                    <td><strong>{title(event.action)}</strong></td>
                    <td>
                      {title(event.entity_type)}
                      <div className="hash-line">{shortId(event.entity_id)}</div>
                    </td>
                    <td>
                      {event.details && Object.keys(event.details).length
                        ? <>
                          <button className="text-button"
                            onClick={() => setExpanded(expanded === event.id ? null : event.id)}>
                            {expanded === event.id ? "Hide" : "Show"} details
                          </button>
                          {expanded === event.id &&
                            <div style={{ marginTop: 8 }}>
                              <JsonTree value={event.details} title="Audit details" />
                            </div>}
                        </>
                        : <span className="small-mark">—</span>}
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <Pagination total={resource.data.total} offset={offset} limit={limit} onChange={setOffset} />
          </>}
    </section>
  </>;
}
