import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunDetail } from "./RunDetail";
import { failure, jsonResponse, mockApi, renderInProject } from "../../test/harness";
import { aResult, aRun, page } from "../../test/factories";

const routes = {
  "GET /runs/r1": aRun(),
  "GET /runs/r1/results": page([aResult()]),
};

const show = () => renderInProject(<RunDetail />, { path: "runs/:runId", route: "/projects/p1/runs/r1" });

describe("RunDetail", () => {
  it("summarises the run and the configuration it recorded", async () => {
    mockApi(routes);
    show();

    expect(await screen.findByRole("heading", { name: "Baseline run", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("3 completed · 1 failed · 4 total")).toBeInTheDocument();
    expect(screen.getByText("Mock · mock-extract-1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View definition" }))
      .toHaveAttribute("href", "/projects/p1/schemas/s1");
  });

  it("lists each document with its score, latency, and cost", async () => {
    mockApi(routes);
    show();

    expect(await screen.findByRole("link", { name: "invoice-104.pdf" }))
      .toHaveAttribute("href", "/projects/p1/results/res1");
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("842.5 ms")).toBeInTheDocument();
  });

  it("filters the documents by status", async () => {
    const mock = mockApi(routes);
    show();
    await screen.findByRole("link", { name: "invoice-104.pdf" });

    await userEvent.selectOptions(screen.getByLabelText("Status"), "failed");
    await waitFor(() => expect(mock.calls.some(call => call.url.includes("status=failed"))).toBe(true));
  });

  it("offers cancellation only while the run is unfinished", async () => {
    const mock = mockApi({
      ...routes,
      "GET /runs/r1": aRun({ status: "running", finished_at: null }),
      "POST /runs/r1/cancel": aRun({ status: "cancelled" }),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Cancel run/ }));
    expect(await screen.findByText(/Run cancelled/)).toBeInTheDocument();
    expect(mock.callsTo("POST /runs/r1/cancel")).toHaveLength(1);
  });

  it("hides cancellation once the run has finished", async () => {
    mockApi(routes);
    show();
    await screen.findByRole("heading", { name: "Baseline run", level: 1 });
    expect(screen.queryByRole("button", { name: /Cancel run/ })).toBeNull();
  });

  it("reports a refused cancellation", async () => {
    mockApi({
      ...routes,
      "GET /runs/r1": aRun({ status: "running" }),
      "POST /runs/r1/cancel": failure(409, "RUN_FINISHED", "The run already finished."),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Cancel run/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The run already finished.");
  });

  it("exports the results in both formats", async () => {
    const mock = mockApi({ ...routes, "GET /runs/r1/export": jsonResponse({}) });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    show();

    await userEvent.click(await screen.findByRole("button", { name: /CSV/ }));
    await userEvent.click(screen.getByRole("button", { name: /JSONL/ }));

    const exports = mock.callsTo("GET /runs/r1/export");
    expect(exports.map(call => call.url)).toEqual([
      "/runs/r1/export?format=csv",
      "/runs/r1/export?format=jsonl",
    ]);
    click.mockRestore();
  });

  it("suggests relaxing the filter when nothing matches", async () => {
    mockApi({ ...routes, "GET /runs/r1/results": page([]) });
    show();
    expect(await screen.findByRole("heading", { name: "No documents match" })).toBeInTheDocument();
  });

  it("shows the error code beside a document that failed", async () => {
    mockApi({
      ...routes,
      "GET /runs/r1/results": page([aResult({
        status: "failed",
        error: { code: "PROVIDER_TIMEOUT", message: "The provider timed out." },
        evaluation: null,
        validation: null,
      })]),
    });
    show();
    expect(await screen.findByText("PROVIDER_TIMEOUT")).toBeInTheDocument();
  });

  it("reports a run that cannot be loaded", async () => {
    mockApi({ ...routes, "GET /runs/r1": failure(404, "NOT_FOUND", "That run was removed.") });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("That run was removed.");
  });
});
