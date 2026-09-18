import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMutation } from "./useMutation";

describe("useMutation", () => {
  it("returns what the operation produced", async () => {
    const { result } = renderHook(() => useMutation());
    let value: string | undefined;
    await act(async () => { value = await result.current.execute(() => Promise.resolve("saved")); });
    expect(value).toBe("saved");
    expect(result.current.error).toBeNull();
  });

  it("reports pending while the request is in flight", async () => {
    const { result } = renderHook(() => useMutation());
    let release = () => undefined as void;
    const pending = new Promise<void>(resolve => { release = () => resolve(); });

    let call: Promise<unknown>;
    act(() => { call = result.current.execute(() => pending); });
    await waitFor(() => expect(result.current.pending).toBe(true));
    await act(async () => { release(); await call; });
    expect(result.current.pending).toBe(false);
  });

  it("keeps the failure instead of throwing at the caller", async () => {
    const { result } = renderHook(() => useMutation());
    let value: unknown;
    await act(async () => {
      value = await result.current.execute(() => Promise.reject(new Error("Name already used.")));
    });
    expect(value).toBeUndefined();
    expect(result.current.error?.message).toBe("Name already used.");
  });

  it("describes a rejection that was not an error", async () => {
    const { result } = renderHook(() => useMutation());
    await act(async () => { await result.current.execute(() => Promise.reject("nope")); });
    expect(result.current.error?.message).toBe("The change could not be saved.");
  });

  it("refuses a second submission while one is running", async () => {
    const { result } = renderHook(() => useMutation());
    const operation = vi.fn(() => new Promise<string>(resolve => setTimeout(() => resolve("done"), 5)));

    let first: Promise<unknown>;
    act(() => { first = result.current.execute(operation); });
    await waitFor(() => expect(result.current.pending).toBe(true));
    await act(async () => {
      await result.current.execute(operation);
      await first;
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("clears a failure so a retry starts clean", async () => {
    const { result } = renderHook(() => useMutation());
    await act(async () => { await result.current.execute(() => Promise.reject(new Error("boom"))); });
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});
