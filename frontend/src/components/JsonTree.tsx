import { useState } from "react";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import type { Json } from "../types/domain";
import { useToast } from "./Toast";

function Scalar({ value }: { value: Json }) {
  if (value === null) return <span className="json-null">null</span>;
  if (typeof value === "string") return <span className="json-string">{JSON.stringify(value)}</span>;
  return <span className={typeof value === "number" ? "json-number" : "json-boolean"}>
    {String(value)}
  </span>;
}

function Node({ value, name, depth, expand }: {
  value: Json;
  name?: string;
  depth: number;
  expand: boolean;
}) {
  const [open, setOpen] = useState(depth < 2 || expand);
  const container = value !== null && typeof value === "object";
  const entries = container ? Object.entries(value) : [];
  const array = Array.isArray(value);
  if (!container) return <div className="json-line" style={{ paddingLeft: depth * 18 }}>
    <span className="json-indent" />
    {name !== undefined && <span className="json-key">{JSON.stringify(name)}: </span>}
    <Scalar value={value} />
  </div>;
  return <div>
    <button className="json-toggle" onClick={() => setOpen(previous => !previous)}
      style={{ paddingLeft: depth * 18 }} aria-expanded={open}>
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      {name !== undefined && <span className="json-key">{JSON.stringify(name)}: </span>}
      <span>{array ? "[" : "{"}</span>
      {!open && <span className="muted">{entries.length} {array ? "items" : "keys"} {array ? "]" : "}"}</span>}
    </button>
    {open && <>
      {entries.map(([key, child]) => <Node key={key} value={child} name={key} depth={depth + 1} expand={expand} />)}
      <div className="json-line" style={{ paddingLeft: depth * 18 + 18 }}>{array ? "]" : "}"}</div>
    </>}
  </div>;
}

export function JsonTree({ value, title = "JSON" }: { value: Json; title?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [revision, setRevision] = useState(0);
  const [copyError, setCopyError] = useState("");
  const toast = useToast();
  return <div className="json-viewer">
    <div className="json-toolbar">
      <strong>{title}</strong>
      <div className="actions">
        <button className="text-button" onClick={() => {
          setExpanded(previous => !previous);
          setRevision(previous => previous + 1);
        }}>{expanded ? "Collapse" : "Expand all"}</button>
        <button className="icon-button" aria-label={"Copy " + title} onClick={async () => {
          try {
            await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
            setCopyError("");
            toast("JSON copied.");
          } catch {
            setCopyError("Clipboard is unavailable. Select the JSON text to copy it.");
          }
        }}><Copy size={15} /></button>
      </div>
    </div>
    {copyError && <p className="inline-error">{copyError}</p>}
    <div className="json-body"><Node key={revision} value={value} depth={0} expand={expanded} /></div>
  </div>;
}
