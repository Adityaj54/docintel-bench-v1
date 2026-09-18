import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricCard, SummaryCards } from "./Metrics";
import { aMetricReport } from "../test/factories";

describe("MetricCard", () => {
  it("shows the label and value", () => {
    render(<MetricCard label="Latency" value="910.0 ms" />);
    expect(screen.getByText("Latency")).toBeInTheDocument();
    expect(screen.getByText("910.0 ms")).toBeInTheDocument();
  });

  it("omits the detail line when there is none", () => {
    const { container } = render(<MetricCard label="Latency" value="910.0 ms" />);
    expect(container.querySelector(".metric-detail")).toBeNull();
  });
});

describe("SummaryCards", () => {
  it("formats every headline metric", () => {
    render(<SummaryCards summary={aMetricReport().summary} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("30 extractions")).toBeInTheDocument();
    expect(screen.getByText("83%")).toBeInTheDocument();
    expect(screen.getByText("76%")).toBeInTheDocument();
    expect(screen.getByText("910.0 ms")).toBeInTheDocument();
    expect(screen.getByText("p95 1.50 s")).toBeInTheDocument();
  });

  it("shows a dash rather than a wrong zero for metrics with no data", () => {
    const summary = aMetricReport().summary;
    render(<SummaryCards summary={{
      ...summary,
      validation_success_rate: null,
      average_evaluation_score: null,
      average_latency_ms: null,
      p95_latency_ms: null,
    }} />);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});
