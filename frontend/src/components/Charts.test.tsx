import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breakdown, VolumeChart } from "./Charts";
import { aMetricReport } from "../test/factories";

describe("VolumeChart", () => {
  it("invites the first extraction when there is no history", () => {
    render(<VolumeChart points={[]} />);
    expect(screen.getByText("Start an extraction to see daily volume.")).toBeInTheDocument();
  });

  it("draws one column per day with a readable label", () => {
    const { container } = render(<VolumeChart points={aMetricReport().volume} />);
    expect(container.querySelectorAll(".chart-column")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Daily extraction volume" })).toBeInTheDocument();
    expect(screen.getByTitle("2026-03-01: 4 completed, 1 failed")).toBeInTheDocument();
  });

  it("scales the tallest day to the full track", () => {
    const { container } = render(<VolumeChart points={aMetricReport().volume} />);
    const stacks = container.querySelectorAll<HTMLElement>(".bar-stack");
    expect(stacks[1].style.height).toBe("100%");
    expect(stacks[0].style.height).toBe(100 * 5 / 7 + "%");
  });

  it("keeps the chart to the last thirty days", () => {
    const points = Array.from({ length: 40 }, (_, index) => ({
      date: "2026-01-" + String(index + 1).padStart(2, "0"),
      total: 1, completed: 1, failed: 0,
    }));
    const { container } = render(<VolumeChart points={points} />);
    expect(container.querySelectorAll(".chart-column")).toHaveLength(30);
  });
});

describe("Breakdown", () => {
  it("shows the caller's empty message when every count is zero", () => {
    render(<Breakdown values={[{ label: "PROVIDER_TIMEOUT", count: 0 }]} empty="No failures recorded." />);
    expect(screen.getByText("No failures recorded.")).toBeInTheDocument();
  });

  it("sizes each bar against the total", () => {
    const { container } = render(<Breakdown values={[
      { label: "application/pdf", count: 3 },
      { label: "image/png", count: 1 },
    ]} />);
    const bars = container.querySelectorAll<HTMLElement>(".breakdown-track > div");
    expect(bars[0].style.width).toBe("75%");
    expect(bars[1].style.width).toBe("25%");
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
  });
});
