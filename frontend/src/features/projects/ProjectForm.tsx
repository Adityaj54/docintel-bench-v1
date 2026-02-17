import { useState, type FormEvent } from "react";
import { post, put } from "../../api/client";
import { Field, ErrorPanel } from "../../components/Feedback";
import { useMutation } from "../../hooks/useMutation";
import type { Project } from "../../types/domain";

export function ProjectForm({ project, onSaved, onCancel }: {
  project?: Project;
  onSaved: (project: Project) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const mutation = useMutation();
  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await mutation.execute(() => project
      ? put<Project>("/projects/" + project.id, { name, description, archived: project.archived })
      : post<Project>("/projects", { name, description }));
    if (saved) onSaved(saved);
  }
  return <form onSubmit={submit} className="form-stack">
    <Field label="Project name">
      <input value={name} required maxLength={120} autoFocus onChange={event => setName(event.target.value)}
        placeholder="e.g. Invoice extraction benchmark" />
    </Field>
    <Field label="Description">
      <textarea value={description} maxLength={4000} rows={3}
        onChange={event => setDescription(event.target.value)} placeholder="What are you evaluating?" />
    </Field>
    <ErrorPanel error={mutation.error} />
    <div className="form-actions">
      {onCancel && <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>}
      <button className="button primary" disabled={mutation.pending}>
        {mutation.pending ? "Saving…" : project ? "Save project" : "Create project"}
      </button>
    </div>
  </form>;
}
