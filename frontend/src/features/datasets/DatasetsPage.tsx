import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderOpen, Plus } from "lucide-react";
import { useProject } from "../../layouts/Workspace";
import { useResource } from "../../hooks/useResource";
import type { Dataset, Page } from "../../types/domain";
import { Dialog } from "../../components/Dialog";
import { Empty, ErrorPanel, Loading, PageHeader } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import { useToast } from "../../components/Toast";
import { dateTime } from "../../utils/format";
import { DatasetForm } from "./DatasetForm";

export function DatasetsPage() {
  const { project } = useProject();
  const navigate = useNavigate();
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const resource = useResource<Page<Dataset>>("/projects/" + project.id + "/datasets?limit=20&offset=" + offset);
  return <>
    <PageHeader eyebrow="DOCUMENT COLLECTIONS" title="Datasets"
      description="Organize PDFs and images into repeatable evaluation sets."
      actions={<button className="button primary" disabled={project.archived} onClick={() => setOpen(true)}>
        <Plus size={17} />New dataset</button>} />
    {resource.loading ? <Loading /> : resource.error ? <ErrorPanel error={resource.error} retry={resource.refresh} />
      : resource.data?.items.length ? <section className="panel">
        <div className="table-scroll"><table>
          <thead><tr><th>Dataset</th><th>Documents</th><th>Last updated</th><th /></tr></thead>
          <tbody>{resource.data.items.map(dataset => <tr key={dataset.id}>
            <td><Link className="table-title" to={"/projects/" + project.id + "/datasets/" + dataset.id}>
              <FolderOpen size={20} />{dataset.name}</Link><small>{dataset.description}</small></td>
            <td>{dataset.document_count}</td><td>{dateTime(dataset.updated_at)}</td>
            <td><Link className="text-link" to={"/projects/" + project.id + "/datasets/" + dataset.id}>Open dataset</Link></td>
          </tr>)}</tbody>
        </table></div>
        <Pagination {...resource.data} onChange={setOffset} />
      </section> : <Empty title="No datasets yet"
        description="Create a collection, then upload documents to start evaluating."
        action={<button className="button primary" disabled={project.archived} onClick={() => setOpen(true)}>Create dataset</button>} />}
    <Dialog title="New dataset" open={open} onClose={() => setOpen(false)}>
      <DatasetForm projectId={project.id} onCancel={() => setOpen(false)} onSaved={dataset => {
        toast("Dataset created.");
        navigate("/projects/" + project.id + "/datasets/" + dataset.id);
      }} />
    </Dialog>
  </>;
}
