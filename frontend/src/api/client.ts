import type { Failure, Page } from "../types/domain";

let csrfToken = "";

export function setCsrfToken(value: string) {
  csrfToken = value;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Failure["details"];

  constructor(status: number, failure: Failure) {
    super(failure.message);
    this.name = "ApiError";
    this.code = failure.code;
    this.status = status;
    this.details = failure.details;
  }
}

export function query(values: Record<string, string | number | boolean | null | undefined>) {
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      parameters.set(name, String(value));
    }
  }
  const encoded = parameters.toString();
  return encoded ? "?" + encoded : "";
}

async function checkedResponse(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const method = options.method ?? "GET";
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  let response: Response;
  try {
    response = await fetch("/api" + path, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, { code: "NETWORK_ERROR", message: "Cannot reach the server. Check your connection." });
  }
  if (!response.ok) {
    let failure: Failure = { code: "HTTP_ERROR", message: "The server could not complete the request." };
    try {
      const payload = await response.json() as { error?: Failure };
      if (payload.error) failure = payload.error;
    } catch {
      // A proxy may return an HTML error page.
    }
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("session-expired"));
    }
    throw new ApiError(response.status, failure);
  }
  return response;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await checkedResponse(path, options);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function post<T>(path: string, data: unknown = {}) {
  return api<T>(path, { method: "POST", body: JSON.stringify(data) });
}

export function put<T>(path: string, data: unknown) {
  return api<T>(path, { method: "PUT", body: JSON.stringify(data) });
}

export async function allPages<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const result: T[] = [];
  let offset = 0;
  for (;;) {
    const separator = path.includes("?") ? "&" : "?";
    const page = await api<Page<T>>(path + separator + "limit=100&offset=" + offset, { signal });
    result.push(...page.items);
    offset += page.items.length;
    if (offset >= page.total || page.items.length === 0) return result;
  }
}

export async function download(path: string, filename: string) {
  const response = await checkedResponse(path);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
