import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./Toast";

function Publisher({ message = "Project created." }: { message?: string }) {
  const toast = useToast();
  return <button onClick={() => toast(message)}>Notify</button>;
}

describe("ToastProvider", () => {
  it("shows a notification in a polite live region", async () => {
    render(<ToastProvider><Publisher /></ToastProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Notify" }));

    const region = screen.getByText("Project created.").closest(".toasts");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("lets the reader dismiss a notification", async () => {
    render(<ToastProvider><Publisher /></ToastProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Notify" }));
    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));

    expect(screen.queryByText("Project created.")).toBeNull();
  });

  it("retires a notification on its own", async () => {
    vi.useFakeTimers();
    render(<ToastProvider><Publisher /></ToastProvider>);
    act(() => screen.getByRole("button", { name: "Notify" }).click());
    expect(screen.getByText("Project created.")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByText("Project created.")).toBeNull();
    vi.useRealTimers();
  });

  it("keeps the stack short when notifications pile up", async () => {
    vi.useFakeTimers();
    render(<ToastProvider><Publisher /></ToastProvider>);
    const button = screen.getByRole("button", { name: "Notify" });
    act(() => { for (let index = 0; index < 8; index++) button.click(); });

    expect(screen.getAllByRole("button", { name: "Dismiss notification" })).toHaveLength(4);
    vi.useRealTimers();
  });

  it("is safe to call outside a provider", async () => {
    render(<Publisher />);
    await userEvent.click(screen.getByRole("button", { name: "Notify" }));
    expect(screen.queryByText("Project created.")).toBeNull();
  });
});
