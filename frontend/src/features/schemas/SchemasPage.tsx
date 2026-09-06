import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Copy, Plus } from "lucide-react";
import { post, put } from "../../api/client";
import { Dialog } from "../../components/Dialog";
import { Empty, ErrorPanel, Field, Loading, PageHeader } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import { Status } from "../../components/Status";
import { useToast } from "../../components/Toast";
import { useMutation } from "../../hooks/useMutation";
import { useResource } from "../../hooks/useResource";
import { useProject } from "../../layouts/Workspace";
import type { Page, Schema } from "../../types/domain";

export function SchemasPage() {
  const { project } = useProject();
  const [offset, setOffset] = useState(0);
  const resource = useResource<Page<Schema>>("/projects/" + project.id + "/schemas?limit=20&offset=" + offset);
  const [clone, setClone] = useState<Schema | null>(null);
  const [name, setName] = useState("");
  const mutation = useMutation();
  const toast = useToast();
  const root = "/projects/" + project.id + "/schemas";
  return <>
    <PageHeader eyebrow="EXTRACTION CONTRACTS" title="Schemas"
      description="Define expected fields. Every edit creates a separate, reproducible version."
      actions={<Link className="button primary" to={root + "/new"}><Plus size={17} />New schema</Link>} />
    <ErrorPanel error={mutation.error} />
    {resource.loading ? <Loading /> : resource.error ? <ErrorPanel error={resource.error} retry={resource.refresh} />
      : resource.data?.items.length ? <section className="panel">
        <div className="table-scroll"><table>
          <thead><tr><th>Schema</th><th>Version</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{resource.data.items.map(schema => <tr key={schema.id}>
            <td><Link to={root + "/" + schema.id} className="table-title"><BookOpen size={18} />{schema.name}</Link>
              <small>{schema.description}</small></td>
            <td><span className="version-label">v{schema.version}</span></td>
            <td><Status value={schema.active ? "active" : "inactive"} /></td>
            <td><div className="actions">
              <button className="button secondary small" disabled={project.archived} onClick={() => {
                setClone(schema); setName(schema.name + " copy"); mutation.clearError();
              }}><Copy size={14} />Clone</button>
              <button className="text-button" disabled={project.archived || mutation.pending} onClick={async () => {
                const result = await mutation.execute(() => put<Schema>("/schemas/" + schema.id + "/activation", {
                  active: !schema.active,
                }));
                if (result) { resource.refresh(); toast("Schema activation updated."); }
              }}>{schema.active ? "Deactivate" : "Activate"}</button>
            </div></td>
          </tr>)}</tbody>
        </table></div><Pagination {...resource.data} onChange={setOffset} />
      </section> : <Empty title="Define your first schema"
        description="Use JSON Schema to describe the structured data you expect from a document."
        action={<Link className="button primary" to={root + "/new"}>Create schema</Link>} />}
    <Dialog title="Clone schema" open={Boolean(clone)} onClose={() => setClone(null)}>
      <form className="form-stack" onSubmit={async event => {
        event.preventDefault();
        const saved = await mutation.execute(() => post<Schema>("/schemas/" + clone?.id + "/clone", { name }));
        if (saved) { setClone(null); resource.refresh(); toast("Schema cloned."); }
      }}>
        <Field label="New schema name"><input required maxLength={120} value={name}
          onChange={event => setName(event.target.value)} /></Field>
        <p className="muted">The new schema starts at version 1 with a copy of the selected definition.</p>
        <ErrorPanel error={mutation.error} />
        <button className="button primary" disabled={mutation.pending}>Clone schema</button>
      </form>
    </Dialog>
  </>;
}
