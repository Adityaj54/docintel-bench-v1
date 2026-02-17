import { useMemo, useId } from "react";
import type { Json } from "../types/domain";

export function parseJson(text: string): { value: Json; error: null } | { value: null; error: string } {
  try {
    return { value: JSON.parse(text) as Json, error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : "Invalid JSON" };
  }
}

export function JsonEditor({ value, onChange, label, rows = 16, hint }: {
  value: string;
  onChange: (text: string) => void;
  label: string;
  rows?: number;
  hint?: string;
}) {
  const identifier = useId();
  const parsed = useMemo(() => parseJson(value), [value]);
  return <div className="json-editor">
    <div className="json-toolbar">
      <label htmlFor={identifier}>{label}</label>
      <button type="button" className="text-button" disabled={Boolean(parsed.error)}
        onClick={() => onChange(JSON.stringify(parsed.value, null, 2))}>Format JSON</button>
    </div>
    <textarea id={identifier} value={value} onChange={event => onChange(event.target.value)}
      rows={rows} spellCheck={false} autoCapitalize="off" autoComplete="off"
      aria-invalid={Boolean(parsed.error)} aria-describedby={identifier + "-help"} />
    <div id={identifier + "-help"} className={"editor-help" + (parsed.error ? " invalid" : "")}>
      {parsed.error || hint || "Valid JSON"}
    </div>
  </div>;
}
