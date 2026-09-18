import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { RunTable } from "./RunTable";
import { mockApi, renderPage } from "../../test/harness";
import { aRun } from "../../test/factories";

describe("RunTable", () => {
  it("shows the run, its provider, and its progress", () => {
    mockApi();
    renderPage(<RunTable runs={[aRun()]} projectId="p1" />);

    expect(screen.getByRole("link", { name: "Baseline run" })).toHaveAttribute("href", "/projects/p1/runs/r1");
    expect(screen.getByText("4 documents")).toBeInTheDocument();
    expect(screen.getByText("Mock")).toBeInTheDocument();
    expect(screen.getByText("mock-extract-1")).toBeInTheDocument();
    expect(screen.getByText("4 / 4 processed")).toBeInTheDocument();
  });

  it("falls back to the creation time for a run that never started", () => {
    mockApi();
    renderPage(<RunTable runs={[aRun({ started_at: null })]} projectId="p1" />);
    expect(screen.getByRole("table")).toHaveTextContent("Mar 1, 2026");
  });

  it("explains an empty list and carries the suggested action", () => {
    mockApi();
    renderPage(<RunTable runs={[]} projectId="p1" emptyAction={<button>New extraction</button>} />);

    expect(screen.getByRole("heading", { name: "No extraction runs yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New extraction" })).toBeInTheDocument();
  });
});
