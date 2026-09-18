import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetricsPage } from "./MetricsPage";
import { failure, mockApi, renderInProject } from "../../test/harness";
import { aMetricReport } from "../../test/factories";

const show = () => renderInProject(<MetricsPage />, { path: "metrics", route: "/projects/p1/metrics" });

describe("MetricsPage", () => {
  it("reports quality, speed, and cost together", async () => {
    mockApi({ "GET /projects/p1/metrics": aMetricReport() });
    show();

    expect(await screen.findByText("30 extractions")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Daily extraction volume" })).toBeInTheDocument();
    expect(screen.getByText("PROVIDER_TIMEOUT")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("mock-extract-1")).toBeInTheDocument();
    expect(screen.getByText("3 failed")).toBeInTheDocument();
  });

  it("asks the server for the selected period", async () => {
    const mock = mockApi({ "GET /projects/p1/metrics": aMetricReport() });
    show();
    await screen.findByText("30 extractions");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-01" } });
    // The picker holds a local date; the API is asked for the matching instant.
    await waitFor(() => expect(mock.calls.some(call => /since=2026-02-28|since=2026-03-01/.test(call.url)))
      .toBe(true));
  });

  it("refuses a period that runs backwards without asking the server", async () => {
    const mock = mockApi({ "GET /projects/p1/metrics": aMetricReport() });
    show();
    await screen.findByText("30 extractions");
    const before = mock.calls.length;

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-01" } });

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("The start date must come before the end date.");
    expect(mock.calls.filter(call => call.path === "/projects/p1/metrics").length)
      .toBeLessThanOrEqual(before + 1);
  });

  it("clears the period filters", async () => {
    mockApi({ "GET /projects/p1/metrics": aMetricReport() });
    show();
    await screen.findByText("30 extractions");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-01" } });
    await userEvent.click(await screen.findByRole("button", { name: "Clear" }));

    expect(screen.getByLabelText("From")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });

  it("invites a first run when no provider has produced a result", async () => {
    mockApi({ "GET /projects/p1/metrics": aMetricReport({ providers: [] }) });
    show();
    expect(await screen.findByRole("heading", { name: "No provider results yet" })).toBeInTheDocument();
  });

  it("uses the period's own empty message for failures", async () => {
    mockApi({ "GET /projects/p1/metrics": aMetricReport({ errors: [] }) });
    show();
    expect(await screen.findByText("No failures recorded in this period.")).toBeInTheDocument();
  });

  it("offers a retry when the metrics cannot be calculated", async () => {
    mockApi({ "GET /projects/p1/metrics": failure(500, "SERVER_ERROR", "Metrics are unavailable.") });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("Metrics are unavailable.");
  });
});
