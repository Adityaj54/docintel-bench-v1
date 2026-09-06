import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Progress, Status } from "./Status";

describe("Status", () => {
  it("renders a readable label for an underscored status", () => {
    render(<Status value="partially_failed" />);
    expect(screen.getByText("Partially Failed")).toBeInTheDocument();
  });

  it("uses the success tone for completed work", () => {
    const { container } = render(<Status value="completed" />);
    expect(container.querySelector(".badge")).toHaveClass("success");
  });

  it("uses the danger tone for failures", () => {
    const { container } = render(<Status value="failed" />);
    expect(container.querySelector(".badge")).toHaveClass("danger");
  });

  it("falls back to a neutral tone for an unrecognised status", () => {
    const { container } = render(<Status value="something_new" />);
    expect(container.querySelector(".badge")).toHaveClass("neutral");
  });
});

describe("Progress", () => {
  it("reports how many documents have settled", () => {
    render(<Progress completed={3} failed={1} total={10} />);
    expect(screen.getByText("4 / 10 processed")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("exposes the progress to assistive technology", () => {
    render(<Progress completed={2} failed={0} total={4} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuemax", "4");
  });

  it("does not divide by zero on an empty run", () => {
    render(<Progress completed={0} failed={0} total={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
