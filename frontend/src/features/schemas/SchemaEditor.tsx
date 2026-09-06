import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Save } from "lucide-react";
import { post } from "../../api/client";
import { ErrorPanel, Field, Loading, PageHeader, Section } from "../../components/Feedback";
import { JsonEditor, parseJson } from "../../components/JsonEditor";
import { useToast } from "../../components/Toast";
import { useMutation } from "../../hooks/useMutation";
import { useResource } from "../../hooks/useResource";
import { useProject } from "../../layouts/Workspace";
import type { Schema, ValidationReport } from "../../types/domain";
import { templates } from "./SchemaTemplates";
import { ValidationIssues } from "./ValidationIssues";

export function SchemaEditor() {
  const { schemaId } = useParams();
  const resource = useResource<Schema>(schemaId ? "/schemas/" + schemaId : null);
  if (resource.loading) return <Loading />;
  if (resource.error) return <ErrorPanel error={resource.error} retry={resource.refresh} />;
  return <Editor key={resource.data?.id ?? "new"} schema={resource.data ?? undefined} />;
}

function Editor({ schema }: { schema?: Schema }) {
  const { project } = useProject();
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(schema?.name ?? "");
  const [description, setDescription] = useState(schema?.description ?? "");
  const [definition, setDefinition] = useState(JSON.stringify(schema?.definition ?? templates["Blank object"], null, 2));
  const [sample, setSample] = useState("{}");
  const [report, setReport] = useState<ValidationReport | null>(null);
  const mutation = useMutation();
  const validation = useMutation();
  const parsed = parseJson(definition);
  const sampleParsed = parseJson(sample);
  const objectSchema = parsed.value !== null && typeof parsed.value === "object" && !Array.isArray(parsed.value);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (parsed.error || !objectSchema) return;
    const saved = await mutation.execute(() => post<Schema>(
      schema ? "/schemas/" + schema.id + "/versions" : "/projects/" + project.id + "/schemas",
      schema ? { description, definition: parsed.value } : { name, description, definition: parsed.value },
    ));
    if (saved) {
      toast(schema ? "Schema version created." : "Schema created.");
      navigate("/projects/" + project.id + "/schemas/" + saved.id);
    }
  }
  return <>
    <PageHeader eyebrow={schema ? "SCHEMA / VERSION " + schema.version : "NEW EXTRACTION CONTRACT"}
      title={schema ? schema.name : "Create schema"}
      description={schema ? "Saving creates a new version. Existing runs keep their original definition."
        : "Start with a template or define your own JSON Schema."}
      actions={<Link className="button secondary" to={"/projects/" + project.id + "/schemas"}>All schemas</Link>} />
    <div className="schema-grid">
      <Section title="Schema definition">
        <form className="panel-body form-stack" onSubmit={submit}>
          <Field label="Name"><input required maxLength={120} value={name} disabled={Boolean(schema)}
            onChange={event => setName(event.target.value)} /></Field>
          <Field label="Description"><textarea rows={2} maxLength={4000} value={description}
            onChange={event => setDescription(event.target.value)} /></Field>
          {!schema && <Field label="Start from a template">
            <select defaultValue="" onChange={event => {
              if (templates[event.target.value]) setDefinition(JSON.stringify(templates[event.target.value], null, 2));
            }}>
              <option value="">Choose a template…</option>
              {Object.keys(templates).map(key => <option key={key}>{key}</option>)}
            </select>
          </Field>}
          <JsonEditor label="JSON Schema" value={definition} onChange={setDefinition} rows={22} />
          {!parsed.error && !objectSchema && <p className="inline-error">Use a JSON object as the schema definition.</p>}
          <ErrorPanel error={mutation.error} />
          <button className="button primary" disabled={project.archived || mutation.pending || Boolean(parsed.error) || !objectSchema}>
            <Save size={16} />{mutation.pending ? "Saving…" : schema ? "Save as new version" : "Create schema"}
          </button>
        </form>
      </Section>
      <Section title="Sample validation" description={schema
        ? "Checks against this saved version, before any edits above." : "Save the schema to validate sample values."}>
        <div className="panel-body form-stack">
          <JsonEditor label="Sample JSON" value={sample} onChange={value => { setSample(value); setReport(null); }} />
          <button className="button secondary" disabled={!schema || validation.pending || Boolean(sampleParsed.error)}
            onClick={async () => {
              const result = await validation.execute(() => post<ValidationReport>("/schemas/" + schema?.id + "/validate", {
                value: sampleParsed.value,
              }));
              if (result) setReport(result);
            }}>{validation.pending ? "Validating…" : "Validate sample"}</button>
          <ErrorPanel error={validation.error} />
          {report && <ValidationIssues report={report} />}
          <div className="notice">Use <code>required</code> for mandatory fields and
            <code> additionalProperties: false</code> to detect unexpected fields.
            Nested objects and arrays are supported.</div>
        </div>
      </Section>
    </div>
  </>;
}
