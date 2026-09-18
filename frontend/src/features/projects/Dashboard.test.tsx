import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { Dashboard } from "./Dashboard";
import { failure, mockApi, renderInProject } from "../../test/harness";
import { aMetricReport, aRun, page } from "../../test/factories";

const routes = {
  "GET /projects/p1/metrics": aMetricReport(),
  "GET /projects/p1/runs": page([aRun()]),
};

describe("Dashboard", () => {
  it("leads with the project and its headline metrics", async () => {
    mockApi(routes);
    renderInProject(<Dashboard />);

    expect(await screen.findByText("WORKSPACE OVERVIEW")).toBeInTheDocument();
    expect(await screen.findByText("30 extractions")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Daily extraction volume" })).toBeInTheDocument();
    expect(screen.getByText("application/pdf")).toBeInTheDocument();
  });

  it("shows the most recent runs with a link to the full list", async () => {
    mockApi(routes);
    renderInProject(<Dashboard />);

    expect(await screen.findByRole("link", { name: "Baseline run" }))
      .toHaveAttribute("href", "/projects/p1/runs/r1");
    expect(screen.getByRole("link", { name: /View all runs/ })).toHaveAttribute("href", "/projects/p1/runs");
  });

  it("points a new project at its first extraction", async () => {
    mockApi({ ...routes, "GET /projects/p1/runs": page([]) });
    renderInProject(<Dashboard />);

    expect(await screen.findByRole("heading", { name: "No extraction runs yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /New extraction/ }))
      .toHaveAttribute("href", "/projects/p1/runs?new=1");
  });

  it("keeps the rest of the page usable when metrics fail", async () => {
    mockApi({ ...routes, "GET /projects/p1/metrics": failure(500, "SERVER_ERROR", "Metrics are unavailable.") });
    renderInProject(<Dashboard />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Metrics are unavailable.");
    expect(await screen.findByRole("link", { name: "Baseline run" })).toBeInTheDocument();
  });
});
