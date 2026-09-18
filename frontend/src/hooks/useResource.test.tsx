import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useResource } from "./useResource";
import { failure, mockApi } from "../test/harness";
import { aProject } from "../test/factories";

describe("useResource", () => {
  it("loads the resource and clears the loading flag", async () => {
    mockApi({ "GET /projects/p1": aProject() });
    const { result } = renderHook(() => useResource<{ name: string }>("/projects/p1"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data?.name).toBe("Invoice benchmark"));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("requests nothing for a null path", async () => {
    const mock = mockApi();
    const { result } = renderHook(() => useResource(null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mock.calls).toHaveLength(0);
    expect(result.current.data).toBeNull();
  });

  it("keeps the failure so the page can offer a retry", async () => {
    mockApi({ "GET /projects/p1": failure(500, "SERVER_ERROR", "The database is unavailable.") });
    const { result } = renderHook(() => useResource("/projects/p1"));

    await waitFor(() => expect(result.current.error?.message).toBe("The database is unavailable."));
    expect(result.current.loading).toBe(false);
  });

  it("refetches on request", async () => {
    let name = "First";
    const mock = mockApi({ "GET /projects/p1": () => aProject({ name }) });
    const { result } = renderHook(() => useResource<{ name: string }>("/projects/p1"));

    await waitFor(() => expect(result.current.data?.name).toBe("First"));
    name = "Renamed";
    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.data?.name).toBe("Renamed"));
    expect(mock.calls).toHaveLength(2);
  });

  it("drops the previous data when the path changes", async () => {
    mockApi({
      "GET /projects/p1": aProject(),
      "GET /projects/p2": aProject({ id: "p2", name: "Receipts" }),
    });
    const { result, rerender } = renderHook(({ path }) => useResource<{ name: string }>(path), {
      initialProps: { path: "/projects/p1" },
    });

    await waitFor(() => expect(result.current.data?.name).toBe("Invoice benchmark"));
    rerender({ path: "/projects/p2" });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data?.name).toBe("Receipts"));
  });

  it("polls while the tab is visible", async () => {
    vi.useFakeTimers();
    const mock = mockApi({ "GET /runs/r1": { status: "running" } });
    const { result } = renderHook(() => useResource("/runs/r1", 1000));

    await vi.waitFor(() => expect(result.current.data).not.toBeNull());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(mock.calls.length).toBeGreaterThan(1);
    vi.useRealTimers();
  });

  it("does not poll a hidden tab", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const mock = mockApi({ "GET /runs/r1": { status: "running" } });
    renderHook(() => useResource("/runs/r1", 1000));

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(mock.calls).toHaveLength(1);
    visibility.mockRestore();
    vi.useRealTimers();
  });

  it("ignores a response that arrives after the component is gone", async () => {
    mockApi({ "GET /projects/p1": aProject() });
    const { result, unmount } = renderHook(() => useResource("/projects/p1"));
    unmount();
    await act(async () => { await Promise.resolve(); });
    expect(result.current.data).toBeNull();
  });
});
