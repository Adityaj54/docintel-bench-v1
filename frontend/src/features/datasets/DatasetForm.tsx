import { useState, type FormEvent } from "react";
import { post, put } from "../../api/client";
import { ErrorPanel, Field } from "../../components/Feedback";
import { useMutation } from "../../hooks/useMutation";
import type { Dataset } from "../../types/domain";

export function DatasetForm({ projectId, dataset, onSaved, onCancel }: {
  projectId: string;
  dataset?: Dataset;
  onSaved: (dataset: Dataset) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(dataset?.name ?? "");
  const [description, setDescription] = useState(dataset?.description ?? "");
  const mutation = useMutation();
  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await mutation.execute(() => dataset
      ? put<Dataset>("/datasets/" + dataset.id, { name, description })
      : post<Dataset>("/projects/" + projectId + "/datasets", { name, description }));
    if (saved) onSaved(saved);
  }
  return <form onSubmit={submit} className="form-stack">
    <Field label="Dataset name">
      <input value={name} required maxLength={120} onChange={event => setName(event.target.value)}
        placeholder="e.g. September invoices" autoFocus />
    </Field>
    <Field label="Description">
      <textarea value={description} maxLength={4000} rows={3}
        onChange={event => setDescription(event.target.value)} />
    </Field>
    <ErrorPanel error={mutation.error} />
    <div className="form-actions">
      <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>
      <button className="button primary" disabled={mutation.pending}>
        {mutation.pending ? "Saving…" : dataset ? "Save dataset" : "Create dataset"}
      </button>
    </div>
  </form>;
}
