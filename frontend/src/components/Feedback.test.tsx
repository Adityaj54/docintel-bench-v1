import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Empty, ErrorPanel, Field, Loading, PageHeader, Section } from "./Feedback";

describe("Loading", () => {
  it("announces itself to assistive technology", () => {
    render(<Loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading workspace…");
  });

  it("uses the label the page supplied", () => {
    render(<Loading label="Loading runs…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading runs…");
  });
});

describe("ErrorPanel", () => {
  it("renders nothing when there is no error", () => {
    const { container } = render(<ErrorPanel error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the message of an Error", () => {
    render(<ErrorPanel error={new Error("The database is unavailable.")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("The database is unavailable.");
  });

  it("accepts a plain string for validation messages", () => {
    render(<ErrorPanel error="The start date must come before the end date." />);
    expect(screen.getByRole("alert")).toHaveTextContent("The start date must come before the end date.");
  });

  it("offers a retry only when one is possible", async () => {
    const retry = vi.fn();
    const { rerender } = render(<ErrorPanel error="Offline" />);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

    rerender(<ErrorPanel error="Offline" retry={retry} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });
});

describe("Empty", () => {
  it("explains the gap and carries the suggested action", () => {
    render(<Empty title="No datasets yet" description="Create a collection first."
      action={<button>Create dataset</button>} />);
    expect(screen.getByRole("heading", { name: "No datasets yet" })).toBeInTheDocument();
    expect(screen.getByText("Create a collection first.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create dataset" })).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("labels the control it wraps", () => {
    render(<Field label="Project name"><input /></Field>);
    expect(screen.getByLabelText("Project name")).toBeInTheDocument();
  });

  it("shows the hint when one is given", () => {
    render(<Field label="Password" hint="At least 12 characters."><input /></Field>);
    expect(screen.getByText("At least 12 characters.")).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renders the optional eyebrow, description, and actions", () => {
    render(<PageHeader eyebrow="EXPERIMENTS" title="Extraction runs" description="Every run is recorded."
      actions={<button>New extraction</button>} />);
    expect(screen.getByText("EXPERIMENTS")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Extraction runs" })).toBeInTheDocument();
    expect(screen.getByText("Every run is recorded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New extraction" })).toBeInTheDocument();
  });

  it("drops the optional parts when they are absent", () => {
    const { container } = render(<PageHeader title="Metrics" />);
    expect(container.querySelector(".eyebrow")).toBeNull();
    expect(container.querySelector(".actions")).toBeNull();
  });
});

describe("Section", () => {
  it("frames its children under a heading", () => {
    render(<Section title="Recent runs" description="Latest experiments" actions={<span>All runs</span>}>
      <p>Body</p>
    </Section>);
    expect(screen.getByRole("heading", { level: 2, name: "Recent runs" })).toBeInTheDocument();
    expect(screen.getByText("Latest experiments")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });
});
