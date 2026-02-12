export function count(value: number) {
  return new Intl.NumberFormat(undefined).format(value);
}

export function percent(value: number | null | undefined) {
  return value == null ? "—" : new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function money(value: number | string | null | undefined) {
  return value == null ? "—" : new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(Number(value));
}

export function latency(value: number | null | undefined) {
  if (value == null) return "—";
  return value < 1000 ? value.toFixed(1) + " ms" : (value / 1000).toFixed(2) + " s";
}

export function bytes(value: number) {
  if (value < 1024) return value + " B";
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
  return (value / (1024 * 1024)).toFixed(1) + " MB";
}

export function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }) : "—";
}

export function dateOnly(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function shortId(value: string) {
  return value.slice(0, 8);
}

export function title(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase());
}

export function terminal(status: string) {
  return ["completed", "failed", "partially_failed", "cancelled"].includes(status);
}
