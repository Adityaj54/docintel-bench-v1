import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { query } from "../../api/client";
import { ErrorPanel, Loading, PageHeader } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import { useResource } from "../../hooks/useResource";
import { useProject } from "../../layouts/Workspace";
import { useToast } from "../../components/Toast";
import type { Page, Run } from "../../types/domain";
import { RunTable } from "./RunTable";
import { RunForm } from "./RunForm";

const statuses = ["", "queued", "running", "completed", "partially_failed", "failed", "cancelled"];

export function RunsPage() {
  const { project } = useProject();
  const navigate = useNavigate();
  const toast = useToast();
  const [parameters, setParameters] = useSearchParams();
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const open = parameters.get("new") === "1";
  const resource = useResource<Page<Run>>(
    "/projects/" + project.id + "/runs" + query({ status, offset, limit }),
    5000,
  );

  function close() {
    parameters.delete("new");
    parameters.delete("dataset");
    setParameters(parameters, { replace: true });
  }

  const newRunButton = <button className="button primary" disabled={project.archived}
    onClick={() => setParameters({ new: "1" }, { replace: true })}>
    <Plus size={17} />New extraction
  </button>;

  return <>
    <PageHeader eyebrow="EXPERIMENTS" title="Extraction runs"
      description="Each run records the provider, model, and schema version it used."
      actions={newRunButton} />

    <div className="toolbar">
      <label className="field inline">
        <span>Status</span>
        <select value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }}>
          {statuses.map(value => <option key={value} value={value}>
            {value ? value.replaceAll("_", " ") : "All statuses"}
          </option>)}
        </select>
      </label>
      {resource.refreshing && <span className="small-mark">Refreshing…</span>}
    </div>

    <ErrorPanel error={resource.error} retry={resource.refresh} />
    <section className="panel">
      {resource.loading ? <Loading label="Loading runs…" /> : <>
        <RunTable runs={resource.data?.items ?? []} projectId={project.id} emptyAction={newRunButton} />
        {resource.data && <Pagination total={resource.data.total} offset={offset}
          limit={limit} onChange={setOffset} />}
      </>}
    </section>

    <RunForm projectId={project.id} open={open} onClose={close}
      initialDataset={parameters.get("dataset") ?? undefined}
      onCreated={run => {
        close();
        toast("Extraction run queued.");
        navigate("/projects/" + project.id + "/runs/" + run.id);
      }} />
  </>;
}
