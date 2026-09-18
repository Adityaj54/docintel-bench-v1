import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { Significance } from "./Significance";
import { aMetricSignificance, aRunSignificance } from "../../test/factories";

function row(label: string) {
  return screen.getByRole("rowheader", { name: new RegExp(label) }).closest("tr") as HTMLElement;
}

describe("Significance", () => {
  it("names the two runs it paired and how many documents carried the test", () => {
    render(<Significance comparisons={[aRunSignificance()]} />);

    expect(screen.getByRole("heading", { name: "Noisy run vs Baseline run" })).toBeInTheDocument();
    expect(screen.getByText(/24 documents ran through both/)).toBeInTheDocument();
    expect(screen.getByText(/95% confidence, Holm-adjusted across 1 metrics/)).toBeInTheDocument();
  });

  it("shows the difference with the interval around it", () => {
    render(<Significance comparisons={[aRunSignificance()]} />);

    const score = within(row("Evaluation score"));
    expect(score.getByText("76%")).toBeInTheDocument();
    expect(score.getByText("83%")).toBeInTheDocument();
    expect(score.getByText("7%")).toBeInTheDocument();
    expect(score.getByText("3% to 11%")).toBeInTheDocument();
  });

  it("calls an improvement better and a regression worse", () => {
    render(<Significance comparisons={[aRunSignificance({
      metrics: [
        aMetricSignificance(),
        aMetricSignificance({
          metric: "average_latency_ms", label: "Latency", direction: "lower",
          baseline_mean: 900, candidate_mean: 1400, difference: 500,
          confidence_low: 300, confidence_high: 700, verdict: "worse",
        }),
      ],
    })]} />);

    expect(within(row("Evaluation score")).getByText("Better")).toBeInTheDocument();
    expect(within(row("Latency")).getByText("Worse")).toBeInTheDocument();
  });

  it("says plainly when the evidence settles nothing", () => {
    render(<Significance comparisons={[aRunSignificance({
      metrics: [aMetricSignificance({
        difference: 0.01, confidence_low: -0.04, confidence_high: 0.06,
        p_value: 0.6, adjusted_p_value: 0.6, verdict: "inconclusive",
      })],
    })]} />);

    expect(screen.getByText("No difference detected")).toBeInTheDocument();
    expect(screen.getByText("24 documents could only detect 4%")).toBeInTheDocument();
  });

  it("reports the strength of the evidence and how it was computed", () => {
    render(<Significance comparisons={[aRunSignificance({
      metrics: [
        aMetricSignificance({ adjusted_p_value: 0.031, exact: true }),
        aMetricSignificance({
          metric: "cost_per_document", label: "Cost per document", direction: "lower",
          adjusted_p_value: 0.0004, exact: false,
        }),
      ],
    })]} />);

    expect(screen.getByText(/p = 0.031 exact/)).toBeInTheDocument();
    expect(screen.getByText(/p < 0.001 sampled/)).toBeInTheDocument();
  });

  it("formats each metric in its own unit", () => {
    render(<Significance comparisons={[aRunSignificance({
      metrics: [
        aMetricSignificance({
          metric: "average_latency_ms", label: "Latency", direction: "lower",
          baseline_mean: 900, candidate_mean: 750, difference: -150,
          confidence_low: -260, confidence_high: -40, verdict: "better",
        }),
        aMetricSignificance({
          metric: "cost_per_document", label: "Cost per document", direction: "lower",
          baseline_mean: 0.004, candidate_mean: 0.006, difference: 0.002,
          confidence_low: 0.001, confidence_high: 0.003, verdict: "worse",
        }),
      ],
    })]} />);

    expect(within(row("Latency")).getByText("900.0 ms")).toBeInTheDocument();
    expect(within(row("Latency")).getByText("-150.0 ms")).toBeInTheDocument();
    expect(within(row("Cost per document")).getByText("$0.004")).toBeInTheDocument();
  });

  it("marks which direction counts as an improvement", () => {
    render(<Significance comparisons={[aRunSignificance()]} />);
    expect(within(row("Evaluation score")).getByText("higher is better")).toBeInTheDocument();
  });

  it("explains a pair of runs with no documents in common", () => {
    render(<Significance comparisons={[aRunSignificance({ paired_documents: 0, metrics: [] })]} />);
    expect(screen.getByRole("heading", { name: "Nothing to pair" })).toBeInTheDocument();
  });

  it("renders one section per candidate run", () => {
    render(<Significance comparisons={[
      aRunSignificance(),
      aRunSignificance({ run_id: "r3", name: "Third run" }),
    ]} />);

    expect(screen.getByRole("heading", { name: "Noisy run vs Baseline run" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Third run vs Baseline run" })).toBeInTheDocument();
  });
});
