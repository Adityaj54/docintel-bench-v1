import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { post, put } from "../../api/client";
import { Dialog } from "../../components/Dialog";
import { Empty, ErrorPanel, Field, Loading, Section } from "../../components/Feedback";
import { Status } from "../../components/Status";
import { useToast } from "../../components/Toast";
import { useMutation } from "../../hooks/useMutation";
import { useResource } from "../../hooks/useResource";
import type { Delivery, Page, Settings, Webhook } from "../../types/domain";
import { dateTime, title } from "../../utils/format";

const eventNames = ["run.completed", "run.failed", "extraction.failed"] as const;

function Deliveries({ projectId, hook }: { projectId: string; hook: Webhook }) {
  const resource = useResource<Page<Delivery>>(
    "/projects/" + projectId + "/webhooks/" + hook.id + "/deliveries?limit=10");
  if (resource.loading) return <Loading label="Loading deliveries…" />;
  if (resource.error) return <ErrorPanel error={resource.error} retry={resource.refresh} />;
  if (!resource.data?.items.length) return <p className="muted">No deliveries attempted yet.</p>;
  return <div className="table-scroll">
    <table>
      <thead>
        <tr>
          <th scope="col">Event</th>
          <th scope="col">Status</th>
          <th scope="col">Attempts</th>
          <th scope="col">Response</th>
          <th scope="col">When</th>
        </tr>
      </thead>
      <tbody>
        {resource.data.items.map(delivery => <tr key={delivery.id}>
          <td>{delivery.event}</td>
          <td><Status value={delivery.status} /></td>
          <td>{delivery.attempts}</td>
          <td className="small-mark">
            {delivery.last_status_code ?? "—"}
            {delivery.last_error && <div>{delivery.last_error}</div>}
          </td>
          <td className="small-mark">{dateTime(delivery.updated_at)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

export function WebhookPanel({ projectId, settings }: {
  projectId: string;
  settings: Settings | null;
}) {
  const resource = useResource<Page<Webhook>>("/projects/" + projectId + "/webhooks?limit=100");
  const mutation = useMutation();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Webhook | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("https://");
  const [events, setEvents] = useState<string[]>(["run.completed"]);
  const [active, setActive] = useState(true);

  function start(hook: Webhook | null) {
    setEditing(hook);
    setName(hook?.name ?? "");
    setUrl(hook?.url ?? "https://");
    setEvents(hook?.events ?? ["run.completed"]);
    setActive(hook?.active ?? true);
    mutation.clearError();
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = { name, url, events, active };
    const saved = await mutation.execute(() => editing
      ? put<Webhook>("/projects/" + projectId + "/webhooks/" + editing.id, body)
      : post<Webhook>("/projects/" + projectId + "/webhooks", body));
    if (saved) {
      toast(editing ? "Webhook updated." : "Webhook created.");
      setOpen(false);
      resource.refresh();
    }
  }

  function toggleEvent(value: string) {
    setEvents(previous => previous.includes(value)
      ? previous.filter(item => item !== value)
      : [...previous, value]);
  }

  return <Section title="Webhooks"
    description="Signed notifications when runs finish. Payloads carry an HMAC-SHA256 signature."
    actions={<button className="button primary small" disabled={!settings?.webhook_enabled}
      onClick={() => start(null)}><Plus size={15} />Add webhook</button>}>

    {settings && !settings.webhook_enabled && <div className="panel-body">
      <div className="notice" style={{ marginBottom: 0 }}>
        <div>
          <strong>Webhook delivery is disabled</strong>
          <p>Set <code>WEBHOOK_SIGNING_KEY</code> in the environment to enable it, and list
            permitted destinations in <code>WEBHOOK_ALLOWED_HOSTS</code>.</p>
        </div>
      </div>
    </div>}

    {settings?.webhook_enabled && settings.webhook_allowed_hosts.length > 0 && <div className="panel-body">
      <p className="small-mark">Allowed hosts: {settings.webhook_allowed_hosts.join(", ")}</p>
    </div>}

    <ErrorPanel error={resource.error} retry={resource.refresh} />
    {resource.loading ? <Loading label="Loading webhooks…" />
      : !resource.data?.items.length
        ? <Empty title="No webhooks configured"
          description="Add one to receive a signed callback when a run finishes." />
        : <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Destination</th>
                <th scope="col">Events</th>
                <th scope="col">State</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {resource.data.items.map(hook => <tr key={hook.id}>
                <td><strong>{hook.name}</strong></td>
                <td className="hash-line">{hook.url}</td>
                <td className="small-mark">{hook.events.join(", ")}</td>
                <td><Status value={hook.active ? "active" : "inactive"} /></td>
                <td>
                  <button className="text-button" onClick={() => start(hook)}>Edit</button>{" "}
                  <button className="text-button"
                    onClick={() => setExpanded(expanded === hook.id ? null : hook.id)}>
                    {expanded === hook.id ? "Hide" : "Deliveries"}
                  </button>
                  {expanded === hook.id && <div style={{ marginTop: 10 }}>
                    <Deliveries projectId={projectId} hook={hook} />
                  </div>}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>}

    <Dialog title={editing ? "Edit webhook" : "Add webhook"} open={open} onClose={() => setOpen(false)}>
      <ErrorPanel error={mutation.error} />
      <form onSubmit={submit}>
        <Field label="Name">
          <input required maxLength={120} value={name} onChange={event => setName(event.target.value)} />
        </Field>
        <Field label="Destination URL"
          hint="HTTPS only, and the hostname must appear in WEBHOOK_ALLOWED_HOSTS.">
          <input required type="url" maxLength={2000} value={url}
            onChange={event => setUrl(event.target.value)} />
        </Field>
        <Field label="Events">
          <div>
            {eventNames.map(value => <label className="field inline" key={value}>
              <input type="checkbox" checked={events.includes(value)}
                onChange={() => toggleEvent(value)} />
              <span>{title(value.replace(".", " "))}</span>
            </label>)}
          </div>
        </Field>
        <label className="field inline">
          <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />
          <span>Deliver events</span>
        </label>
        {!events.length && <p className="inline-error">Select at least one event.</p>}
        <div className="form-actions">
          <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="button primary" disabled={mutation.pending || !events.length}>
            {mutation.pending ? "Saving…" : "Save webhook"}
          </button>
        </div>
      </form>
    </Dialog>
  </Section>;
}
