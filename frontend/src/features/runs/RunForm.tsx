import { useEffect, useState, type FormEvent } from "react";
import { post } from "../../api/client";
import { Dialog } from "../../components/Dialog";
import { ErrorPanel, Field } from "../../components/Feedback";
import { useMutation } from "../../hooks/useMutation";
import { useResource } from "../../hooks/useResource";
import type { Dataset, EvaluationOptions, Page, Provider, Run, Schema } from "../../types/domain";

const defaults: EvaluationOptions = {
  normalize_strings: true,
  case_sensitive: false,
  numeric_tolerance: 0.01,
  relative_tolerance: 0,
  array_order: "ordered",
  ignore_extra_fields: false,
};

export function RunForm({ projectId, open, initialDataset, onClose, onCreated }: {
  projectId: string;
  open: boolean;
  initialDataset?: string;
  onClose: () => void;
  onCreated: (run: Run) => void;
}) {
  const datasets = useResource<Page<Dataset>>(open ? "/projects/" + projectId + "/datasets?limit=100" : null);
  const schemas = useResource<Page<Schema>>(open ? "/projects/" + projectId + "/schemas?limit=100" : null);
  const providers = useResource<Page<Provider>>(open ? "/projects/" + projectId + "/providers?limit=100" : null);
  const mutation = useMutation();
  const [name, setName] = useState("");
  const [datasetId, setDatasetId] = useState(initialDataset ?? "");
  const [schemaId, setSchemaId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [options, setOptions] = useState<EvaluationOptions>(defaults);
  const [advanced, setAdvanced] = useState(false);

  const activeSchemas = schemas.data?.items.filter(schema => schema.active) ?? [];
  const usableProviders = providers.data?.items.filter(item => item.active && item.available) ?? [];

  useEffect(() => {
    if (!open) return;
    setName("Run " + new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }));
    setOptions(defaults);
    setAdvanced(false);
    mutation.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (initialDataset) setDatasetId(initialDataset);
  }, [initialDataset]);

  useEffect(() => {
    if (!datasetId && datasets.data?.items.length) setDatasetId(datasets.data.items[0].id);
  }, [datasets.data, datasetId]);

  useEffect(() => {
    if (!schemaId && activeSchemas.length) setSchemaId(activeSchemas[0].id);
  }, [schemas.data, schemaId, activeSchemas]);

  useEffect(() => {
    if (!providerId && usableProviders.length) setProviderId(usableProviders[0].id);
  }, [providers.data, providerId, usableProviders]);

  const blocked = !datasets.data?.items.length || !activeSchemas.length || !usableProviders.length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const run = await mutation.execute(() => post<Run>("/projects/" + projectId + "/runs", {
      name,
      dataset_id: datasetId,
      schema_id: schemaId,
      provider_configuration_id: providerId,
      evaluation_options: options,
    }));
    if (run) onCreated(run);
  }

  function setOption<K extends keyof EvaluationOptions>(key: K, value: EvaluationOptions[K]) {
    setOptions(previous => ({ ...previous, [key]: value }));
  }

  return <Dialog title="Start an extraction run" open={open} onClose={onClose} wide>
    <ErrorPanel error={mutation.error} />
    {blocked ? <p className="muted">
      A run needs at least one dataset, one active schema, and one available provider
      configuration. Create the missing pieces first.
    </p> : <form onSubmit={submit}>
      <Field label="Run name">
        <input required maxLength={120} value={name} onChange={event => setName(event.target.value)} />
      </Field>
      <div className="form-stack two">
        <Field label="Dataset" hint="Every document in the dataset is queued.">
          <select required value={datasetId} onChange={event => setDatasetId(event.target.value)}>
            {datasets.data?.items.map(dataset => <option key={dataset.id} value={dataset.id}>
              {dataset.name} ({dataset.document_count} documents)
            </option>)}
          </select>
        </Field>
        <Field label="Schema" hint="The version selected here is recorded on the run.">
          <select required value={schemaId} onChange={event => setSchemaId(event.target.value)}>
            {activeSchemas.map(schema => <option key={schema.id} value={schema.id}>
              {schema.name} · v{schema.version}
            </option>)}
          </select>
        </Field>
      </div>
      <Field label="Provider configuration" hint="Providers without credentials are hidden.">
        <select required value={providerId} onChange={event => setProviderId(event.target.value)}>
          {usableProviders.map(item => <option key={item.id} value={item.id}>
            {item.name} · {item.provider}/{item.model}
          </option>)}
        </select>
      </Field>

      <button type="button" className="text-button" onClick={() => setAdvanced(value => !value)}>
        {advanced ? "Hide" : "Show"} evaluation options
      </button>

      {advanced && <div className="form-stack two" style={{ marginTop: 12 }}>
        <Field label="Numeric tolerance" hint="Absolute difference treated as a match.">
          <input type="number" min={0} max={1000000} step="0.001" value={options.numeric_tolerance}
            onChange={event => setOption("numeric_tolerance", Number(event.target.value))} />
        </Field>
        <Field label="Relative tolerance" hint="Fraction of the expected value.">
          <input type="number" min={0} max={1} step="0.001" value={options.relative_tolerance}
            onChange={event => setOption("relative_tolerance", Number(event.target.value))} />
        </Field>
        <Field label="Array comparison" hint="Unordered pairs elements by best fit.">
          <select value={options.array_order}
            onChange={event => setOption("array_order", event.target.value as EvaluationOptions["array_order"])}>
            <option value="ordered">Ordered</option>
            <option value="unordered">Unordered</option>
          </select>
        </Field>
        <div>
          <label className="field inline">
            <input type="checkbox" checked={options.case_sensitive}
              onChange={event => setOption("case_sensitive", event.target.checked)} />
            <span>Case sensitive strings</span>
          </label>
          <label className="field inline">
            <input type="checkbox" checked={options.normalize_strings}
              onChange={event => setOption("normalize_strings", event.target.checked)} />
            <span>Normalise whitespace and unicode</span>
          </label>
          <label className="field inline">
            <input type="checkbox" checked={options.ignore_extra_fields}
              onChange={event => setOption("ignore_extra_fields", event.target.checked)} />
            <span>Ignore fields absent from ground truth</span>
          </label>
        </div>
      </div>}

      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="button primary" disabled={mutation.pending}>
          {mutation.pending ? "Queueing…" : "Start run"}
        </button>
      </div>
    </form>}
  </Dialog>;
}
