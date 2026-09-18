import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "./Dialog";

function open(onClose = vi.fn(), wide = false) {
  const view = render(<Dialog title="New project" open onClose={onClose} wide={wide}>
    <p>Form body</p>
  </Dialog>);
  return { ...view, onClose };
}

describe("Dialog", () => {
  it("shows its contents once it is open", () => {
    open();
    expect(screen.getByRole("dialog", { name: "New project" })).toBeVisible();
    expect(screen.getByText("Form body")).toBeInTheDocument();
  });

  it("keeps the children out of the DOM while closed", () => {
    render(<Dialog title="New project" open={false} onClose={vi.fn()}><p>Form body</p></Dialog>);
    expect(screen.queryByText("Form body")).toBeNull();
  });

  it("opens and closes as the owner flips the flag", () => {
    const { rerender, container } = render(
      <Dialog title="New project" open={false} onClose={vi.fn()}><p>Form body</p></Dialog>);
    const dialog = container.querySelector("dialog");
    expect(dialog?.open).toBe(false);

    rerender(<Dialog title="New project" open onClose={vi.fn()}><p>Form body</p></Dialog>);
    expect(dialog?.open).toBe(true);

    rerender(<Dialog title="New project" open={false} onClose={vi.fn()}><p>Form body</p></Dialog>);
    expect(dialog?.open).toBe(false);
  });

  it("closes from the header button", async () => {
    const onClose = vi.fn();
    open(onClose);
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the backdrop itself is clicked", async () => {
    const onClose = vi.fn();
    const { container } = open(onClose);
    await userEvent.click(container.querySelector("dialog") as HTMLDialogElement);
    expect(onClose).toHaveBeenCalled();
  });

  it("stays open when the click lands inside the panel", async () => {
    const onClose = vi.fn();
    open(onClose);
    await userEvent.click(screen.getByText("Form body"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    const { container } = open(onClose);
    (container.querySelector("dialog") as HTMLDialogElement).dispatchEvent(new Event("cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("can be widened for the larger forms", () => {
    const { container } = open(vi.fn(), true);
    expect(container.querySelector("dialog")).toHaveClass("wide");
  });

  it("stays narrow by default", () => {
    const { container } = open();
    expect(container.querySelector("dialog")).not.toHaveClass("wide");
  });
});
