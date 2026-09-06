import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore } from "lucide-react";
import { put } from "../../api/client";
import { ErrorPanel, Field, PageHeader, Section } from "../../components/Feedback";
import { useToast } from "../../components/Toast";
import { useMutation } from "../../hooks/useMutation";
import { useResource } from "../../hooks/useResource";
import { useProject } from "../../layouts/Workspace";
import type { Project, Settings } from "../../types/domain";
import { bytes, title } from "../../utils/format";
import { ProviderPanel } from "./ProviderPanel";
import { WebhookPanel } from "./WebhookPanel";

export function SettingsPage() {
  const { project, refresh } = useProject();
  const navigate = useNavigate();
  const toast = useToast();
  const details = useMutation();
  const archiving = useMutation();
  const settings = useResource<Settings>("/settings");
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);

  async function save(event: FormEvent) {
    event.preventDefault();
    const saved = await details.execute(() => put<Project>("/projects/" + project.id, {
      name, description, archived: project.archived,
    }));
    if (saved) {
      toast("Project details saved.");
      refresh();
    }
  }

  async function toggleArchive() {
    const saved = await archiving.execute(() => put<Project>("/projects/" + project.id, {
      name: project.name, description: project.description, archived: !project.archived,
    }));
    if (saved) {
      toast(saved.archived ? "Project archived." : "Project restored.");
      refresh();
      if (saved.archived) navigate("/projects");
    }
  }

  return <>
    <PageHeader eyebrow="PROJECT CONFIGURATION" title="Settings"
      description="Provider configurations, webhooks, and the project lifecycle." />

    <Section title="Project details" description="Shown across the workspace and in exports.">
      <form className="panel-body" onSubmit={save}>
        <ErrorPanel error={details.error} />
        <Field label="Name">
          <input required maxLength={120} value={name} disabled={project.archived}
            onChange={event => setName(event.target.value)} />
        </Field>
        <Field label="Description">
          <textarea rows={3} maxLength={4000} value={description} disabled={project.archived}
            onChange={event => setDescription(event.target.value)} />
        </Field>
        <div className="form-actions">
          <button type="submit" className="button primary"
            disabled={details.pending || project.archived}>
            {details.pending ? "Saving…" : "Save details"}
          </button>
        </div>
      </form>
    </Section>

    <ProviderPanel projectId={project.id} settings={settings.data} />
    <WebhookPanel projectId={project.id} settings={settings.data} />

    {settings.data && <Section title="Environment"
      description="Read-only limits enforced by the server for this deployment.">
      <div className="panel-body">
        <div className="document-metadata">
          <div><span>Storage backend</span><strong>{title(settings.data.storage_backend)}</strong></div>
          <div><span>Maximum upload size</span><strong>{bytes(settings.data.max_upload_bytes)}</strong></div>
          <div><span>Maximum PDF pages</span><strong>{settings.data.max_pdf_pages}</strong></div>
          <div><span>Maximum documents per run</span><strong>{settings.data.max_run_documents}</strong></div>
          <div><span>Providers with credentials</span><strong>
            {Object.entries(settings.data.providers)
              .filter(([, available]) => available)
              .map(([provider]) => title(provider)).join(", ") || "None"}
          </strong></div>
        </div>
      </div>
    </Section>}

    <Section title={project.archived ? "Restore project" : "Archive project"}
      description={project.archived
        ? "Restoring makes the project editable again. Nothing was deleted."
        : "Archiving keeps every run and document but blocks further changes."}>
      <div className="panel-body">
        <ErrorPanel error={archiving.error} />
        <button className={"button " + (project.archived ? "primary" : "secondary")}
          disabled={archiving.pending} onClick={() => void toggleArchive()}>
          {project.archived ? <><ArchiveRestore size={16} />Restore project</>
            : <><Archive size={16} />Archive project</>}
        </button>
      </div>
    </Section>
  </>;
}
