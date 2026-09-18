import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComparePage } from "./ComparePage";
import { failure, mockApi, renderInProject } from "../../test/harness";
import { aComparison, aMetricReport, aRun, page } from "../../test/factories";

const runs = page([aRun(), aRun({ id: "r2", name: "Noisy run" })]);
const faster = {
  ...aMetricReport().providers[0],
  average_score: 0.9,
  average_latency_ms: 500,
  cost_per_document: 0.2,
};

const routes = {
  "GET /projects/p1/runs": runs,
  "GET /projects/p1/comparison": [
    aComparison(),
    aComparison({ run_id: "r2", name: "Noisy run", metrics: faster }),
  ],
};

const show = () => renderInProject(<ComparePage />, { path: "compare", route: "/projects/p1/compare" });

describe("ComparePage", () => {
  it("asks for two runs before it compares anything", async () => {
    mockApi(routes);
    show();

    expect(await screen.findByRole("heading", { name: "Select two runs to compare" })).toBeInTheDocument();
    expect(screen.getByText("0 of 8 selected")).toBeInTheDocument();
  });

  it("compares the selected runs side by side", async () => {
    mockApi(routes);
    show();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Compare Baseline run" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Compare Noisy run" }));

    expect(await screen.findByRole("heading", { name: "Side by side" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Evaluation score" })).toBeInTheDocument();
  });

  it("highlights the stronger value in each row", async () => {
    mockApi(routes);
    show();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Compare Baseline run" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Compare Noisy run" }));
    await screen.findByRole("heading", { name: "Side by side" });

    const row = screen.getByRole("rowheader", { name: "Evaluation score" }).closest("tr") as HTMLElement;
    expect(within(row).getByText("90%").tagName).toBe("STRONG");
    expect(within(row).getByText("76%").tagName).not.toBe("STRONG");
  });

  it("asks the server only for the runs that are selected", async () => {
    const mock = mockApi(routes);
    show();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Compare Baseline run" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Compare Noisy run" }));

    await waitFor(() => expect(mock.callsTo("GET /projects/p1/comparison")).toHaveLength(1));
    expect(mock.callsTo("GET /projects/p1/comparison")[0].url).toContain("run_ids=r1&run_ids=r2");
  });

  it("lets a run be unselected again", async () => {
    mockApi(routes);
    show();

    const checkbox = await screen.findByRole("checkbox", { name: "Compare Baseline run" });
    await userEvent.click(checkbox);
    expect(screen.getByText("1 of 8 selected")).toBeInTheDocument();

    await userEvent.click(checkbox);
    expect(screen.getByText("0 of 8 selected")).toBeInTheDocument();
  });

  it("points at the runs page when there is nothing to compare", async () => {
    mockApi({ ...routes, "GET /projects/p1/runs": page([]) });
    show();

    expect(await screen.findByRole("heading", { name: "No runs to compare" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New extraction/ }))
      .toHaveAttribute("href", "/projects/p1/runs?new=1");
  });

  it("offers a retry when the comparison fails", async () => {
    mockApi({ ...routes, "GET /projects/p1/comparison": failure(500, "SERVER_ERROR", "The comparison failed.") });
    show();

    await userEvent.click(await screen.findByRole("checkbox", { name: "Compare Baseline run" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Compare Noisy run" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The comparison failed.");
  });
});
