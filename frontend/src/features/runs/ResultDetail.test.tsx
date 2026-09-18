import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultDetail } from "./ResultDetail";
import { failure, mockApi, renderInProject } from "../../test/harness";
import { aGroundTruth, aResult, aValidationReport } from "../../test/factories";

const show = () => renderInProject(<ResultDetail />, {
  path: "results/:resultId",
  route: "/projects/p1/results/res1",
});

describe("ResultDetail", () => {
  it("leads with the document, provider, and headline numbers", async () => {
    mockApi({ "GET /results/res1": aResult() });
    show();

    expect(await screen.findByRole("heading", { name: "invoice-104.pdf", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Mock · mock-extract-1 · attempt 1")).toBeInTheDocument();
    expect(screen.getByText("8 of 10 fields")).toBeInTheDocument();
    expect(screen.getByText("2,040")).toBeInTheDocument();
    expect(screen.getByText("1,800 in · 240 out")).toBeInTheDocument();
  });

  it("scores the extraction against the trusted annotation", async () => {
    mockApi({ "GET /results/res1": aResult() });
    show();

    expect(await screen.findByText(/Scored against version 3/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Differences from ground truth" })).toBeInTheDocument();
    expect(screen.getByText("$.total")).toBeInTheDocument();
  });

  it("promotes a good extraction to ground truth", async () => {
    const mock = mockApi({
      "GET /results/res1": aResult(),
      "POST /results/res1/promote": aGroundTruth({ version: 4 }),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Use as ground truth/ }));
    expect(await screen.findByText("Saved as ground truth version 4.")).toBeInTheDocument();
    expect(mock.callsTo("POST /results/res1/promote")).toHaveLength(1);
  });

  it("cannot promote a failed extraction", async () => {
    mockApi({
      "GET /results/res1": aResult({
        status: "failed",
        output: null,
        evaluation: null,
        validation: null,
        error: { code: "PROVIDER_TIMEOUT", message: "The provider timed out." },
      }),
    });
    show();

    expect(await screen.findByText("The provider timed out.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Use as ground truth/ })).toBeNull();
  });

  it("reports a refused promotion", async () => {
    mockApi({
      "GET /results/res1": aResult(),
      "POST /results/res1/promote": failure(422, "INVALID_GROUND_TRUTH", "The output does not satisfy the schema."),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Use as ground truth/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The output does not satisfy the schema.");
  });

  it("lists the schema violations when validation failed", async () => {
    mockApi({ "GET /results/res1": aResult({ validation: aValidationReport() }) });
    show();

    expect(await screen.findByText("1 violation(s) found.")).toBeInTheDocument();
    expect(screen.getByText("'12,40' is not of type 'number'")).toBeInTheDocument();
  });

  it("says plainly that a valid output has no violations", async () => {
    mockApi({ "GET /results/res1": aResult() });
    show();
    expect(await screen.findByText("No violations.")).toBeInTheDocument();
  });

  it("warns when the provider output had to be normalised", async () => {
    mockApi({
      "GET /results/res1": aResult({
        normalization_warnings: [{ path: "$.total", message: "coerced '12,40' to 12.4" }],
      }),
    });
    show();

    expect(await screen.findByText(/Provider output was normalised/)).toBeInTheDocument();
    expect(screen.getByText(/coerced '12,40' to 12.4/)).toBeInTheDocument();
  });

  it("keeps the raw provider response available when there is one", async () => {
    mockApi({ "GET /results/res1": aResult({ raw_response: { text: "```json{}```" } }) });
    show();

    const section = (await screen.findByRole("heading", { name: "Raw provider response" })).closest("section");
    expect(within(section as HTMLElement).getByRole("button", { name: "Copy Raw provider response" })).toBeInTheDocument();
  });

  it("links back to the run and the document", async () => {
    mockApi({ "GET /results/res1": aResult() });
    show();

    expect(await screen.findByRole("link", { name: /Back to run/ }))
      .toHaveAttribute("href", "/projects/p1/runs/r1");
    expect(screen.getByRole("link", { name: "Open document" }))
      .toHaveAttribute("href", "/projects/p1/documents/doc1");
  });

  it("reports a result that cannot be loaded", async () => {
    mockApi({ "GET /results/res1": failure(404, "NOT_FOUND", "That result was removed.") });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("That result was removed.");
  });
});
