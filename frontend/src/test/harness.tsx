import type { ReactElement } from "react";
import { expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { vi } from "vitest";
import { ToastProvider } from "../components/Toast";
import { AuthProvider } from "../features/auth/AuthContext";
import { Workspace } from "../layouts/Workspace";
import { aProject, aSession } from "./factories";

export interface ApiCall {
  method: string;
  path: string;
  url: string;
  body: unknown;
  headers: Headers;
}

type Handler = ((request: ApiCall) => unknown) | unknown;

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A response shaped like the API's error envelope. */
export function failure(status: number, code: string, message = "The request could not be completed.") {
  return jsonResponse({ error: { code, message } }, status);
}

export interface ApiMock {
  calls: ApiCall[];
  route: (key: string, handler: Handler) => void;
  callsTo: (key: string) => ApiCall[];
}

/**
 * Replaces fetch with a small router. Keys are "METHOD /path" (GET by default) and may end
 * in "*" to match a prefix; query strings are ignored when matching. A handler may be a value
 * (sent as JSON), a Response, a function of the request, or undefined for 204.
 */
export function mockApi(routes: Record<string, Handler> = {}): ApiMock {
  const table = new Map<string, Handler>();
  const calls: ApiCall[] = [];

  function key(value: string) {
    const [method, path] = value.includes(" ") ? value.split(" ") : ["GET", value];
    return method.toUpperCase() + " " + path;
  }

  function route(name: string, handler: Handler) {
    table.set(key(name), handler);
  }

  route("GET /auth/me", aSession());
  route("GET /projects/p1", aProject());
  for (const [name, handler] of Object.entries(routes)) route(name, handler);

  function lookup(method: string, path: string): { handler: Handler } | null {
    const exact = method + " " + path;
    if (table.has(exact)) return { handler: table.get(exact) };
    let best: { length: number; handler: Handler } | null = null;
    for (const [name, handler] of table) {
      const [candidateMethod, candidatePath] = name.split(" ");
      if (candidateMethod !== method || !candidatePath.endsWith("*")) continue;
      const prefix = candidatePath.slice(0, -1);
      if (path.startsWith(prefix) && (!best || prefix.length > best.length)) {
        best = { length: prefix.length, handler };
      }
    }
    return best ? { handler: best.handler } : null;
  }

  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options: RequestInit = {}) => {
    const url = String(input).replace(/^\/api/, "");
    const method = (options.method ?? "GET").toUpperCase();
    const path = url.split("?")[0];
    const raw = options.body;
    const call: ApiCall = {
      method,
      path,
      url,
      body: typeof raw === "string" ? JSON.parse(raw) as unknown : raw ?? null,
      headers: new Headers(options.headers),
    };
    calls.push(call);
    const match = lookup(method, path);
    if (!match) return failure(404, "NOT_MOCKED", "No mock for " + method + " " + path);
    const handler = match.handler;
    const value = typeof handler === "function"
      ? await (handler as (request: ApiCall) => unknown)(call)
      : handler;
    // Cloned so a handler may hand out the same response to repeated calls.
    if (value instanceof Response) return value.clone();
    if (value === undefined) return new Response(null, { status: 204 });
    return jsonResponse(value);
  }));

  return {
    calls,
    route,
    callsTo: name => {
      const [method, path] = key(name).split(" ");
      return calls.filter(call => call.method === method && call.path === path);
    },
  };
}

function Location() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname + location.search}</span>;
}

/** Renders a component inside a router and the toast provider. */
export function renderPage(ui: ReactElement, { route = "/" }: { route?: string } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>
    <ToastProvider>{ui}<Location /></ToastProvider>
  </MemoryRouter>);
}

/** Renders a component that needs a signed-in session. */
export function renderWithSession(ui: ReactElement, { route = "/" }: { route?: string } = {}) {
  return render(<MemoryRouter initialEntries={[route]}>
    <AuthProvider><ToastProvider>{ui}<Location /></ToastProvider></AuthProvider>
  </MemoryRouter>);
}

/**
 * Renders a page that lives inside the project workspace, so `useProject` and the sidebar
 * behave exactly as they do in the application.
 */
export function renderInProject(element: ReactElement, { path = "", route = "/projects/p1" }: {
  path?: string;
  route?: string;
} = {}) {
  return render(<MemoryRouter initialEntries={[route]}>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/projects" element={<h1>All projects</h1>} />
          <Route path="/projects/:projectId" element={<Workspace />}>
            {path
              ? <Route path={path} element={element} />
              : <Route index element={element} />}
          </Route>
        </Routes>
        <Location />
      </ToastProvider>
    </AuthProvider>
  </MemoryRouter>);
}

/** Waits for the router to settle on an address. */
export async function waitForPath(path: string) {
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent(path));
}
