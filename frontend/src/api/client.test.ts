import { afterEach, describe, expect, it, vi } from "vitest";
import { allPages, api, ApiError, download, post, put, query, setCsrfToken } from "./client";
import { type ApiCall, failure, jsonResponse, mockApi } from "../test/harness";
import { page } from "../test/factories";

afterEach(() => setCsrfToken(""));

describe("query", () => {
  it("encodes the values that carry meaning", () => {
    expect(query({ status: "running", offset: 20 })).toBe("?status=running&offset=20");
  });

  it("omits blank, null, and undefined filters", () => {
    expect(query({ search: "", status: null, entity: undefined })).toBe("");
  });

  it("keeps a false value, which is a real filter", () => {
    expect(query({ archived: false })).toBe("?archived=false");
  });
});

describe("api", () => {
  it("returns the decoded body", async () => {
    mockApi({ "GET /projects/p1": { id: "p1", name: "Invoice benchmark" } });
    await expect(api("/projects/p1")).resolves.toMatchObject({ name: "Invoice benchmark" });
  });

  it("treats an empty 204 as no content", async () => {
    mockApi({ "DELETE /documents/doc1": undefined });
    await expect(api("/documents/doc1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("sends cookies so the session travels with every call", async () => {
    mockApi({ "GET /auth/me": { id: "u1" } });
    await api("/auth/me");
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });

  it("adds the CSRF token to unsafe methods only", async () => {
    setCsrfToken("token-abc");
    const mock = mockApi({ "GET /projects": page([]), "POST /projects": { id: "p2" } });
    await api("/projects");
    await post("/projects", { name: "New" });
    expect(mock.calls[0].headers.get("X-CSRF-Token")).toBeNull();
    expect(mock.calls[1].headers.get("X-CSRF-Token")).toBe("token-abc");
  });

  it("declares JSON for a body it serialised", async () => {
    const mock = mockApi({ "PUT /projects/p1": { id: "p1" } });
    await put("/projects/p1", { name: "Renamed" });
    expect(mock.calls[0].headers.get("Content-Type")).toBe("application/json");
    expect(mock.calls[0].body).toEqual({ name: "Renamed" });
  });

  it("lets the browser set the boundary for a file upload", async () => {
    const mock = mockApi({ "POST /datasets/d1/documents": { id: "doc1" } });
    const form = new FormData();
    form.append("file", new File(["x"], "invoice.pdf"));
    await api("/datasets/d1/documents", { method: "POST", body: form });
    expect(mock.calls[0].headers.get("Content-Type")).toBeNull();
  });

  it("raises the failure the server described", async () => {
    mockApi({ "POST /projects": failure(422, "INVALID_NAME", "The name is already used.") });
    const error = await post("/projects", {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "INVALID_NAME", status: 422, message: "The name is already used." });
  });

  it("falls back to a generic failure when the body is not the API's", async () => {
    mockApi({ "GET /projects": new Response("<html>502</html>", { status: 502 }) });
    await expect(api("/projects")).rejects.toMatchObject({ code: "HTTP_ERROR", status: 502 });
  });

  it("reports an unreachable server rather than the raw network error", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(api("/projects")).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });

  it("lets an abort travel as an abort, so callers can ignore it", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.reject(new DOMException("The operation was aborted.", "AbortError"))));
    await expect(api("/projects")).rejects.toMatchObject({ name: "AbortError" });
  });

  it("announces an expired session so the shell can sign the user out", async () => {
    mockApi({ "GET /projects": failure(401, "NOT_AUTHENTICATED") });
    const expired = vi.fn();
    window.addEventListener("session-expired", expired);
    await api("/projects").catch(() => undefined);
    window.removeEventListener("session-expired", expired);
    expect(expired).toHaveBeenCalled();
  });

  it("stays quiet when the sign-in attempt itself is rejected", async () => {
    mockApi({ "POST /auth/login": failure(401, "INVALID_CREDENTIALS") });
    const expired = vi.fn();
    window.addEventListener("session-expired", expired);
    await post("/auth/login", {}).catch(() => undefined);
    window.removeEventListener("session-expired", expired);
    expect(expired).not.toHaveBeenCalled();
  });
});

describe("allPages", () => {
  it("follows the pagination until every item is collected", async () => {
    const mock = mockApi({
      "GET /projects/p1/datasets": (request: ApiCall) => request.url.includes("offset=0")
        ? page([{ id: "d1" }, { id: "d2" }], { total: 3, limit: 100 })
        : page([{ id: "d3" }], { total: 3, limit: 100, offset: 2 }),
    });
    await expect(allPages("/projects/p1/datasets")).resolves.toHaveLength(3);
    expect(mock.calls).toHaveLength(2);
  });

  it("appends its paging to a path that already has a query", async () => {
    const mock = mockApi({ "GET /projects/p1/runs": page([], { total: 0, limit: 100 }) });
    await allPages("/projects/p1/runs?status=completed");
    expect(mock.calls[0].url).toBe("/projects/p1/runs?status=completed&limit=100&offset=0");
  });

  it("stops on an empty page rather than looping forever", async () => {
    const mock = mockApi({ "GET /projects/p1/runs": page([], { total: 9, limit: 100 }) });
    await expect(allPages("/projects/p1/runs")).resolves.toEqual([]);
    expect(mock.calls).toHaveLength(1);
  });
});

describe("download", () => {
  it("hands the browser a named file and releases the object URL", async () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:export", revokeObjectURL: revoke });
    mockApi({ "GET /runs/r1/export": jsonResponse({ rows: [] }) });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await download("/runs/r1/export?format=csv", "run-r1.csv");

    expect(click).toHaveBeenCalled();
    expect(document.querySelector("a")).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(revoke).toHaveBeenCalledWith("blob:export");
    click.mockRestore();
    vi.useRealTimers();
  });
});
