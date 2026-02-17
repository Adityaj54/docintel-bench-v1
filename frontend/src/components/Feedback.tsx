import { AlertCircle, FileSearch, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

export function Loading({ label = "Loading workspace…" }: { label?: string }) {
  return <div className="loading" role="status">
    <LoaderCircle size={24} className="spin" />
    <span>{label}</span>
  </div>;
}

export function ErrorPanel({ error, retry }: { error: Error | string | null; retry?: () => void }) {
  if (!error) return null;
  return <div className="error-panel" role="alert">
    <AlertCircle size={20} />
    <div>
      <strong>Something needs attention</strong>
      <p>{typeof error === "string" ? error : error.message}</p>
      {retry && <button className="button secondary small" onClick={retry}>Try again</button>}
    </div>
  </div>;
}

export function Empty({ title, description, action }: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <div className="empty">
    <div className="empty-icon"><FileSearch size={28} /></div>
    <h3>{title}</h3>
    <p>{description}</p>
    {action}
  </div>;
}

export function Field({ label, hint, children }: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return <label className="field">
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>;
}

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return <header className="page-header">
    <div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="subtitle">{description}</p>}
    </div>
    {actions && <div className="actions">{actions}</div>}
  </header>;
}

export function Section({ title, description, actions, children }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return <section className="panel">
    <div className="panel-heading">
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {actions}
    </div>
    {children}
  </section>;
}
