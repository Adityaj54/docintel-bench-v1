import { useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, UploadCloud, XCircle } from "lucide-react";
import { api } from "../../api/client";
import type { Document } from "../../types/domain";
import { bytes } from "../../utils/format";

interface UploadItem {
  id: number;
  name: string;
  size: number;
  state: "queued" | "uploading" | "done" | "failed";
  message: string;
}

export function UploadPanel({ datasetId, onUploaded, disabled = false }: {
  datasetId: string;
  onUploaded: () => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const nextId = useRef(0);
  async function upload(files: FileList | File[]) {
    if (busy || disabled) return;
    const selected = Array.from(files);
    if (!selected.length) return;
    const batch = selected.map(file => ({
      file,
      id: ++nextId.current,
    }));
    setBusy(true);
    setItems(previous => [...previous, ...batch.map(({ file, id }) => ({
      id, name: file.name, size: file.size, state: "queued" as const, message: "",
    }))]);
    for (const { file, id } of batch) {
      setItems(previous => previous.map(item => item.id === id ? { ...item, state: "uploading" } : item));
      const data = new FormData();
      data.append("file", file);
      try {
        await api<Document>("/datasets/" + datasetId + "/documents", { method: "POST", body: data });
        setItems(previous => previous.map(item => item.id === id ? {
          ...item, state: "done", message: "Uploaded · preprocessing queued",
        } : item));
        onUploaded();
      } catch (error) {
        setItems(previous => previous.map(item => item.id === id ? {
          ...item, state: "failed", message: error instanceof Error ? error.message : "Upload failed.",
        } : item));
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }
  return <section className="upload-panel">
    <button type="button" className={"dropzone" + (dragging ? " dragging" : "")}
      disabled={disabled || busy} onClick={() => input.current?.click()}
      onDragOver={event => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        event.preventDefault();
        setDragging(false);
        void upload(event.dataTransfer.files);
      }}>
      <UploadCloud size={30} />
      <strong>{busy ? "Uploading documents…" : "Drop documents here, or browse files"}</strong>
      <span>PDF, PNG, JPEG, and WebP · validated and deduplicated on upload</span>
    </button>
    <input ref={input} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" hidden
      onChange={event => event.target.files && void upload(event.target.files)} />
    {items.length > 0 && <div className="upload-results" aria-live="polite">
      {items.map(item => <div className={"upload-row " + item.state} key={item.id}>
        {item.state === "done" ? <CheckCircle2 size={18} /> : item.state === "failed"
          ? <XCircle size={18} /> : <LoaderCircle size={18} className="spin" />}
        <div><strong>{item.name}</strong><small>{item.message || item.state}</small></div>
        <span>{bytes(item.size)}</span>
      </div>)}
      {!busy && <button className="text-button" onClick={() => setItems([])}>Clear upload history</button>}
    </div>}
  </section>;
}
