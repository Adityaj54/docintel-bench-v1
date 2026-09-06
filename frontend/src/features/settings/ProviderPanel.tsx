import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { post, put } from "../../api/client";
import { Dialog } from "../../components/Dialog";
import { Empty, ErrorPanel, Field, Loading, Section } from "../../components/Feedback";
import { Status } from "../../components/Status";
import { useToast } from "../../components/Toast";
import { useMutation } from "../../hooks/useMutation";
import { useResource } from "../../hooks/useResource";
import type { Page, Provider, ProviderOptions, Settings } from "../../types/domain";
import { money, title } from "../../utils/format";

const blank: ProviderOptions = {
  max_tokens: 4096,
  input_cost_per_million: 0,
  output_cost_per_million: 0,
  variant: "baseline",
  failure_every: 0,
  response_format: "plain",
};

export function ProviderPanel({ projectId, settings }: {
  projectId: string;
  settings: Settings | null;
}) {
  const resource = useResource<Page<Provider>>("/projects/" + projectId + "/providers?limit=100");
  const mutation = useMutation();
  const toast = useToast();
  const [editing, setEditing] = useState<Provider | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider["provider"]>("mock");
  const [model, setModel] = useState("mock-extract-1");
  const [active, setActive] = useState(true);
  const [options, setOptions] = useState<ProviderOptions>(blank);

  function start(existing: Provider | null) {
    setEditing(existing);
    setName(existing?.name ?? "");
    setProvider(existing?.provider ?? "mock");
    setModel(existing?.model ?? "mock-extract-1");
    setActive(existing?.active ?? true);
    setOptions(existing?.options ?? blank);
    mutation.clearError();
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = { name, provider, model, options, active };
    const saved = await mutation.execute(() => editing
      ? put<Provider>("/providers/" + editing.id, body)
      : post<Provider>("/projects/" + projectId + "/providers", body));
    if (saved) {
      toast(editing ? "Provider configuration updated." : "Provider configuration created.");
      setOpen(false);
      resource.refresh();
    }
  }

  function setOption<K extends keyof ProviderOptions>(key: K, value: ProviderOptions[K]) {
    setOptions(previous => ({ ...previous, [key]: value }));
  }

  const unavailable = settings && !settings.providers[provider];

  return <Section title="Provider configurations"
    description="Models and pricing used by extraction runs. API keys stay in the environment."
    actions={<button className="button primary small" onClick={() => start(null)}>
      <Plus size={15} />Add configuration
    </button>}>
    <ErrorPanel error={resource.error} retry={resource.refresh} />
    {resource.loading ? <Loading label="Loading providers…" />
      : !resource.data?.items.length
        ? <Empty title="No provider configurations"
          description="Add one to start extraction runs. The mock provider needs no credentials."
          action={<button className="button primary" onClick={() => start(null)}>Add configuration</button>} />
        : <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Model</th>
                <th scope="col">Cost / 1M tokens</th>
                <th scope="col">State</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {resource.data.items.map(item => <tr key={item.id}>
                <td><strong>{item.name}</strong>
                  <div className="small-mark">{title(item.provider)}</div></td>
                <td>{item.model}</td>
                <td className="small-mark">
                  {money(item.options.input_cost_per_million)} in ·{" "}
                  {money(item.options.output_cost_per_million)} out
                </td>
                <td>
                  <Status value={item.active ? "active" : "inactive"} />
                  {!item.available && <div className="small-mark">Credentials missing</div>}
                </td>
                <td><button className="text-button" onClick={() => start(item)}>Edit</button></td>
              </tr>)}
            </tbody>
          </table>
        </div>}

    <Dialog title={editing ? "Edit provider configuration" : "Add provider configuration"}
      open={open} onClose={() => setOpen(false)} wide>
      <ErrorPanel error={mutation.error} />
      <form onSubmit={submit}>
        <div className="form-stack two">
          <Field label="Name">
            <input required maxLength={120} value={name} onChange={event => setName(event.target.value)} />
          </Field>
          <Field label="Provider" hint={unavailable
            ? "No API key is configured for this provider, so runs cannot use it."
            : undefined}>
            <select value={provider}
              onChange={event => setProvider(event.target.value as Provider["provider"])}>
              <option value="mock">Mock (no credentials)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </Field>
          <Field label="Model" hint="Letters, digits, and . _ : / - only.">
            <input required maxLength={120} pattern="[a-zA-Z0-9._:/\-]+" value={model}
              onChange={event => setModel(event.target.value)} />
          </Field>
          <Field label="Max tokens">
            <input type="number" min={256} max={16000} value={options.max_tokens}
              onChange={event => setOption("max_tokens", Number(event.target.value))} />
          </Field>
          <Field label="Input cost per 1M tokens">
            <input type="number" min={0} max={1000} step="0.01" value={options.input_cost_per_million}
              onChange={event => setOption("input_cost_per_million", Number(event.target.value))} />
          </Field>
          <Field label="Output cost per 1M tokens">
            <input type="number" min={0} max={10000} step="0.01" value={options.output_cost_per_million}
              onChange={event => setOption("output_cost_per_million", Number(event.target.value))} />
          </Field>
        </div>

        {provider === "mock" && <div className="form-stack two">
          <Field label="Scenario" hint="Noisy output exercises the normalisation layer.">
            <select value={options.variant}
              onChange={event => setOption("variant", event.target.value as ProviderOptions["variant"])}>
              <option value="baseline">Baseline</option>
              <option value="noisy">Noisy</option>
            </select>
          </Field>
          <Field label="Response shape" hint="Simulates fenced, wrapped, or malformed JSON.">
            <select value={options.response_format}
              onChange={event => setOption("response_format",
                event.target.value as ProviderOptions["response_format"])}>
              <option value="plain">Plain JSON</option>
              <option value="fenced">Markdown code fence</option>
              <option value="wrapped">Wrapper object</option>
              <option value="malformed">Malformed</option>
            </select>
          </Field>
          <Field label="Fail every Nth document" hint="0 disables simulated failures.">
            <input type="number" min={0} max={20} value={options.failure_every}
              onChange={event => setOption("failure_every", Number(event.target.value))} />
          </Field>
        </div>}

        <label className="field inline">
          <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />
          <span>Available for new runs</span>
        </label>

        <div className="form-actions">
          <button type="button" className="button secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="submit" className="button primary" disabled={mutation.pending}>
            {mutation.pending ? "Saving…" : "Save configuration"}
          </button>
        </div>
      </form>
    </Dialog>
  </Section>;
}
