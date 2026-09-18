import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Difference } from "../../types/domain";
import { Differences } from "./Differences";

function difference(overrides: Partial<Difference>): Difference {
  return {
    path: "/total",
    actual_path: "/total",
    status: "changed",
    expected_present: true,
    actual_present: true,
    expected: 10,
    actual: 12,
    expected_type: "number",
    actual_type: "number",
    ...overrides,
  };
}

function show(rows: Difference[]) {
  return render(<MemoryRouter><Differences differences={rows} /></MemoryRouter>);
}

describe("Differences", () => {
  it("explains that there is nothing to compare without ground truth", () => {
    show([]);
    expect(screen.getByText("Nothing to compare")).toBeInTheDocument();
  });

  it("hides matching fields by default so problems stand out", () => {
    show([
      difference({ path: "/invoice_number", status: "match" }),
      difference({ path: "/total", status: "changed" }),
    ]);
    expect(screen.queryByText("/invoice_number")).not.toBeInTheDocument();
    expect(screen.getByText("/total")).toBeInTheDocument();
  });

  it("reveals matching fields on request", async () => {
    show([
      difference({ path: "/invoice_number", status: "match" }),
      difference({ path: "/total", status: "changed" }),
    ]);
    await userEvent.click(screen.getByLabelText("Show matching fields"));
    expect(screen.getByText("/invoice_number")).toBeInTheDocument();
  });

  it("says so when every field agreed", () => {
    show([difference({ status: "match" })]);
    expect(screen.getByText("Every field matched")).toBeInTheDocument();
  });

  it("orders the most severe differences first", () => {
    show([
      difference({ path: "/c", status: "extra" }),
      difference({ path: "/a", status: "missing" }),
      difference({ path: "/b", status: "changed" }),
    ]);
    const rendered = screen.getAllByText(/^\/[abc]$/).map(node => node.textContent);
    expect(rendered).toEqual(["/a", "/b", "/c"]);
  });

  it("marks a value the provider never returned as absent", () => {
    show([difference({ status: "missing", actual_present: false, actual: null })]);
    expect(screen.getByText("absent")).toBeInTheDocument();
  });

  it("notes when an unordered array matched a different position", () => {
    show([difference({ path: "/lines/0", actual_path: "/lines/1" })]);
    expect(screen.getByText("matched against /lines/1")).toBeInTheDocument();
  });

  it("shortens a long value rather than flooding the row", () => {
    show([difference({ actual: "x".repeat(200), actual_type: "string" })]);
    expect(screen.getByText("x".repeat(120) + "…")).toBeInTheDocument();
  });

  it("counts each kind of difference in the summary", () => {
    show([
      difference({ path: "/a", status: "missing" }),
      difference({ path: "/b", status: "extra" }),
      difference({ path: "/c", status: "changed" }),
    ]);
    const summary = screen.getByText("Show matching fields").closest(".toolbar") as HTMLElement;
    expect(summary).toHaveTextContent("Missing 1");
    expect(summary).toHaveTextContent("Extra 1");
    expect(summary).toHaveTextContent("Changed 1");
  });
});
