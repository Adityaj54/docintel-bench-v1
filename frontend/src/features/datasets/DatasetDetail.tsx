import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Edit3, File, Play, Search } from "lucide-react";
import { query } from "../../api/client";
import { Dialog } from "../../components/Dialog";
import { Empty, ErrorPanel, Loading, PageHeader } from "../../components/Feedback";
import { Pagination } from "../../components/Pagination";
import { Status } from "../../components/Status";
import { useToast } from "../../components/Toast";
import { useResource } from "../../hooks/useResource";
import { useProject } from "../../layouts/Workspace";
import type { Dataset, Document, Page } from "../../types/domain";
import { bytes, dateTime } from "../../utils/format";
import { DatasetForm } from "./DatasetForm";
import { UploadPanel } from "./UploadPanel";

export function DatasetDetail() {
  const { datasetId } = useParams();
  const { project } = useProject();
  const [edit, setEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const toast = useToast();
  const dataset = useResource<Dataset>("/datasets/" + datasetId);
  const documents = useResource<Page<Document>>("/datasets/" + datasetId + "/documents" +
    query({ search, status, offset, limit: 20 }), 3000);
  if (dataset.loading) return <Loading />;
  if (dataset.error) return <ErrorPanel error={dataset.error} retry={dataset.refresh} />;
  if (!dataset.data) return null;
  return <>
    <PageHeader eyebrow="DATASET" title={dataset.data.name} description={dataset.data.description}
      actions={<>
        <button className="button secondary" disabled={project.archived} onClick={() => setEdit(true)}>
          <Edit3 size={16} />Edit</button>
        <Link className="button primary" to={"/projects/" + project.id + "/runs?new=1&dataset=" + datasetId}>
          <Play size={16} />Run extraction</Link>
      </>} />
    <UploadPanel datasetId={dataset.data.id} disabled={project.archived} onUploaded={() => {
      dataset.refresh();
      documents.refresh();
    }} />
    <div className="toolbar">
      <label className="search-input"><Search size={16} />
        <input aria-label="Search documents" placeholder="Search documents…" value={search}
          onChange={event => { setSearch(event.target.value); setOffset(0); }} />
      </label>
      <select aria-label="Document status" value={status}
        onChange={event => { setStatus(event.target.value); setOffset(0); }}>
        <option value="">All statuses</option><option value="ready">Ready</option>
        <option value="queued">Queued</option><option value="processing">Processing</option><option value="failed">Failed</option>
      </select>
    </div>
    <ErrorPanel error={documents.error} retry={documents.refresh} />
    {documents.loading ? <Loading /> : documents.data?.items.length ? <section className="panel">
      <div className="table-scroll"><table>
        <thead><tr><th>Document</th><th>Status</th><th>Pages</th><th>Size</th><th>Uploaded</th></tr></thead>
        <tbody>{documents.data.items.map(document => <tr key={document.id}>
          <td><Link className="table-title" to={"/projects/" + project.id + "/documents/" + document.id}>
            <File size={19} />{document.original_filename}</Link><small>{document.mime_type}</small></td>
          <td><Status value={document.status} /></td><td>{document.page_count}</td>
          <td>{bytes(document.size_bytes)}</td><td>{dateTime(document.created_at)}</td>
        </tr>)}</tbody>
      </table></div>
      <Pagination {...documents.data} onChange={setOffset} />
    </section> : <Empty title="No documents found" description="Upload a file above, or adjust your filters." />}
    <Dialog title="Edit dataset" open={edit} onClose={() => setEdit(false)}>
      <DatasetForm projectId={project.id} dataset={dataset.data} onCancel={() => setEdit(false)} onSaved={() => {
        setEdit(false); dataset.refresh(); toast("Dataset updated.");
      }} />
    </Dialog>
  </>;
}
