import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunsPage } from "./RunsPage";
import { failure, mockApi, renderInProject, waitForPath } from "../../test/harness";
import { aDataset, aProject, aProvider, aRun, aSchema, page } from "../../test/factories";

const routes = {
  "GET /projects/p1/runs": page([aRun()]),
  "GET /projects/p1/datasets": page([aDataset()]),
  "GET /projects/p1/schemas": page([aSchema()]),
  "GET /projects/p1/providers": page([aProvider()]),
};

const show = (route = "/projects/p1/runs") =>
  renderInProject(<RunsPage />, { path: "runs", route });

describe("RunsPage", () => {
  it("lists the project's runs", async () => {
    mockApi(routes);
    show();
    expect(await screen.findByRole("link", { name: "Baseline run" })).toBeInTheDocument();
  });

  it("asks the server for a single status", async () => {
    const mock = mockApi(routes);
    show();
    await screen.findByRole("link", { name: "Baseline run" });

    await userEvent.selectOptions(screen.getByLabelText("Status"), "failed");
    await waitFor(() => expect(mock.calls.some(call => call.url.includes("status=failed"))).toBe(true));
  });

  it("opens the run dialog from the address the dashboard links to", async () => {
    mockApi(routes);
    show("/projects/p1/runs?new=1");
    expect(await screen.findByRole("dialog", { name: "Start an extraction run" })).toBeVisible();
  });

  it("queues a run and opens it", async () => {
    mockApi({ ...routes, "POST /projects/p1/runs": aRun({ id: "r9" }) });
    show("/projects/p1/runs?new=1");

    await userEvent.click(await screen.findByRole("button", { name: "Start run" }));

    expect(await screen.findByText("Extraction run queued.")).toBeInTheDocument();
    await waitForPath("/projects/p1/runs/r9");
  });

  it("keeps the dialog closed until it is asked for", async () => {
    mockApi(routes);
    show();
    await screen.findByRole("link", { name: "Baseline run" });
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(screen.getAllByRole("button", { name: /New extraction/ })[0]);
    expect(await screen.findByRole("dialog", { name: "Start an extraction run" })).toBeVisible();
  });

  it("pages through a long history", async () => {
    const mock = mockApi({ ...routes, "GET /projects/p1/runs": page([aRun()], { total: 60 }) });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Next/ }));
    await waitFor(() => expect(mock.calls.some(call => call.url.includes("offset=20"))).toBe(true));
  });

  it("blocks new runs in an archived project", async () => {
    mockApi({ ...routes, "GET /projects/p1": aProject({ archived: true }) });
    show();
    expect(await screen.findByRole("button", { name: /New extraction/ })).toBeDisabled();
  });

  it("offers a retry when the history cannot be loaded", async () => {
    mockApi({ ...routes, "GET /projects/p1/runs": failure(500, "SERVER_ERROR", "Runs are unavailable.") });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("Runs are unavailable.");
  });
});
