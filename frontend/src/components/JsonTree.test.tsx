import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JsonTree } from "./JsonTree";
import { ToastProvider } from "./Toast";

const invoice = {
  vendor: "Acme",
  total: 120.5,
  paid: false,
  reference: null,
  address: { city: { name: "Berlin", postcode: "10115" } },
};

function show(value: Parameters<typeof JsonTree>[0]["value"], title?: string) {
  return render(<ToastProvider><JsonTree value={value} title={title} /></ToastProvider>);
}

describe("JsonTree", () => {
  it("renders each scalar with its type", () => {
    const { container } = show(invoice);
    expect(container.querySelector(".json-string")).toHaveTextContent('"Acme"');
    expect(container.querySelector(".json-number")).toHaveTextContent("120.5");
    expect(container.querySelector(".json-boolean")).toHaveTextContent("false");
    expect(container.querySelector(".json-null")).toHaveTextContent("null");
  });

  it("collapses deeply nested branches and summarises them", () => {
    show(invoice);
    expect(screen.getByText(/2 keys/)).toBeInTheDocument();
    expect(screen.queryByText('"Berlin"')).toBeNull();
  });

  it("opens a collapsed branch when it is clicked", async () => {
    show(invoice);
    await userEvent.click(screen.getByText(/2 keys/));
    expect(screen.getByText('"Berlin"')).toBeInTheDocument();
  });

  it("expands and collapses everything at once", async () => {
    show(invoice);
    await userEvent.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getByText('"Berlin"')).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText('"Berlin"')).toBeNull();
  });

  it("counts array items rather than keys", () => {
    show({ order: { items: ["pens", "paper"] } });
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
  });

  it("copies the JSON and confirms it", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    show({ total: 1 }, "Extracted output");

    await userEvent.click(screen.getByRole("button", { name: "Copy Extracted output" }));
    expect(writeText).toHaveBeenCalledWith('{\n  "total": 1\n}');
    expect(await screen.findByText("JSON copied.")).toBeInTheDocument();
  });

  it("explains what to do when the clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: () => Promise.reject(new Error("denied")) },
    });
    show({ total: 1 });

    await userEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
    expect(await screen.findByText(/Clipboard is unavailable/)).toBeInTheDocument();
  });
});
