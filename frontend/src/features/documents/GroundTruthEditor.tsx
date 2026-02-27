import { useRef, useState, type FormEvent } from "react";
import { Upload } from "lucide-react";
import { put } from "../../api/client";
import { ErrorPanel, Field, Loading } from "../../components/Feedback";
import { JsonEditor, parseJson } from "../../components/JsonEditor";
import { useToast } from "../../components/Toast";
import { useResource } from "../../hooks/useResource";
import { useMutation } from "../../hooks/useMutation";
import type { GroundTruth, Page, Schema } from "../../types/domain";

export function GroundTruthEditor({ projectId, documentId, disabled }: {
  projectId: string;
  documentId: string;
  disabled: boolean;
}) {
  const schemas = useResource<Page<Schema>>("/projects/" + projectId + "/schemas");
  const truths = useResource<GroundTruth[]>("/documents/" + documentId + "/ground-truth");
  const [schemaId, setSchemaId] = useState("");
  const selected = schemaId || schemas.data?.items[0]?.id || "";
  const truth = truths.data?.find(item => item.schema_id === selected);
  if (schemas.loading || truths.loading) return <Loading />;
  if (schemas.error || truths.error) return <ErrorPanel error={schemas.error || truths.error}
    retry={() => { schemas.refresh(); truths.refresh(); }} />;
  return <div className="form-stack">
    <Field label="Annotation schema">
      <select value={selected} onChange={event => setSchemaId(event.target.value)}>
        {!schemas.data?.items.length && <option value="">Create a schema first</option>}
        {schemas.data?.items.map(schema => <option key={schema.id} value={schema.id}>
          {schema.name} · v{schema.version}{schema.active ? "" : " · inactive"}
        </option>)}
      </select>
    </Field>
    {selected && <TruthForm key={selected + ":" + (truth?.version ?? 0)} schemaId={selected}
      documentId={documentId} truth={truth} disabled={disabled} onSaved={truths.refresh} />}
  </div>;
}

function TruthForm({ schemaId, documentId, truth, disabled, onSaved }: {
  schemaId: string;
  documentId: string;
  truth?: GroundTruth;
  disabled: boolean;
  onSaved: () => void;
}) {
  const [text, setText] = useState(JSON.stringify(truth?.value ?? {}, null, 2));
  const [source, setSource] = useState("manual");
  const [importError, setImportError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const mutation = useMutation();
  const toast = useToast();
  const parsed = parseJson(text);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (parsed.error) return;
    const saved = await mutation.execute(() => put<GroundTruth>("/documents/" + documentId + "/ground-truth", {
      schema_id: schemaId, value: parsed.value, expected_version: truth?.version ?? null, source,
    }));
    if (saved) {
      toast("Ground truth saved. Completed results will be reevaluated.");
      onSaved();
    }
  }
  return <form className="form-stack" onSubmit={submit}>
    <div className="split-label">
      <span className="muted">{truth ? "Revision " + truth.version + " · " + truth.source : "No annotation yet"}</span>
      <button type="button" className="button secondary small" disabled={disabled}
        onClick={() => input.current?.click()}><Upload size={14} />Import JSON</button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 100000) {
          setImportError("Use a JSON file smaller than 100 KB.");
          return;
        }
        try {
          const content = await file.text();
          const result = parseJson(content);
          if (result.error) throw new Error(result.error);
          setText(JSON.stringify(result.value, null, 2));
          setSource("import");
          setImportError("");
        } catch (error) {
          setImportError(error instanceof Error ? error.message : "Could not import JSON.");
        }
      }} />
    </div>
    <JsonEditor label="Trusted JSON" value={text} onChange={value => { setText(value); setSource("manual"); }}
      hint="Values must satisfy the selected schema. Saving records an audited revision." />
    <ErrorPanel error={importError || mutation.error} />
    <button className="button primary" disabled={disabled || mutation.pending || Boolean(parsed.error)}>
      {mutation.pending ? "Saving…" : "Save ground truth"}
    </button>
  </form>;
}
