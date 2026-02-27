import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, RotateCw, Trash2 } from "lucide-react";
import { api, download, post } from "../../api/client";
import { Dialog } from "../../components/Dialog";
import { Empty, ErrorPanel, Loading, PageHeader, Section } from "../../components/Feedback";
import { Status } from "../../components/Status";
import { useToast } from "../../components/Toast";
import { useMutation } from "../../hooks/useMutation";
import { useResource } from "../../hooks/useResource";
import { useProject } from "../../layouts/Workspace";
import type { Document } from "../../types/domain";
import { bytes, dateTime } from "../../utils/format";
import { GroundTruthEditor } from "./GroundTruthEditor";

export function DocumentDetail() {
  const { documentId } = useParams();
  const { project } = useProject();
  const resource = useResource<Document>("/documents/" + documentId, 3000);
  const mutation = useMutation();
  const navigate = useNavigate();
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [remove, setRemove] = useState(false);
  if (resource.loading) return <Loading />;
  if (resource.error) return <ErrorPanel error={resource.error} retry={resource.refresh} />;
  const document = resource.data;
  if (!document) return null;
  const artifact = document.artifacts[page];
  return <>
    <PageHeader eyebrow="DOCUMENT INSPECTOR" title={document.original_filename}
      description={document.mime_type + " · " + bytes(document.size_bytes) + " · " + document.page_count + " page(s)"}
      actions={<>
        <button className="button secondary" onClick={() => void mutation.execute(() =>
          download("/documents/" + document.id + "/original", document.original_filename))}>
          <Download size={16} />Original</button>
        <button className="button danger secondary" disabled={project.archived} onClick={() => setRemove(true)}>
          <Trash2 size={16} />Delete</button>
      </>} />
    <ErrorPanel error={mutation.error} />
    <div className="document-metadata">
      <Status value={document.status} /><span>Uploaded {dateTime(document.created_at)}</span>
      <Link className="text-link" to={"/projects/" + project.id + "/datasets/" + document.dataset_id}>Back to dataset</Link>
    </div>
    {document.error && <ErrorPanel error={document.error.message} />}
    {document.status === "failed" && <button className="button secondary" disabled={mutation.pending || project.archived}
      onClick={async () => {
        const saved = await mutation.execute(() => post<Document>("/documents/" + document.id + "/retry"));
        if (saved) { resource.refresh(); toast("Preprocessing queued."); }
      }}><RotateCw size={16} />Retry preprocessing</button>}
    <div className="document-grid">
      <Section title="Document preview" description="Normalized pages used for extraction"
        actions={<div className="actions">
          <button className="icon-button" aria-label="Previous page" disabled={page <= 0}
            onClick={() => setPage(value => value - 1)}><ChevronLeft size={18} /></button>
          <small>{document.artifacts.length ? page + 1 : 0} / {document.artifacts.length}</small>
          <button className="icon-button" aria-label="Next page" disabled={page >= document.artifacts.length - 1}
            onClick={() => setPage(value => value + 1)}><ChevronRight size={18} /></button>
        </div>}>
        {artifact ? <div className="document-preview">
          <img src={artifact.url} alt={document.original_filename + " page " + artifact.page} />
        </div> : <Empty title="Preview is being prepared" description="Rendered pages appear after preprocessing finishes." />}
        <div className="hash-line"><strong>SHA-256</strong><code>{document.sha256}</code></div>
      </Section>
      <Section title="Ground truth" description="Trusted values for evaluating extraction quality">
        <div className="panel-body">
          <GroundTruthEditor projectId={project.id} documentId={document.id} disabled={project.archived} />
        </div>
      </Section>
    </div>
    <Dialog title="Delete document?" open={remove} onClose={() => setRemove(false)}>
      <p>The original file and rendered pages will be removed. Existing extraction results remain available.</p>
      <ErrorPanel error={mutation.error} />
      <div className="form-actions">
        <button className="button secondary" onClick={() => setRemove(false)}>Keep document</button>
        <button className="button danger" disabled={mutation.pending} onClick={async () => {
          const result = await mutation.execute(() => api<{ message: string }>("/documents/" + document.id, { method: "DELETE" }));
          if (result) {
            toast("Document deleted.");
            navigate("/projects/" + project.id + "/datasets/" + document.dataset_id);
          }
        }}>Delete document</button>
      </div>
    </Dialog>
  </>;
}
