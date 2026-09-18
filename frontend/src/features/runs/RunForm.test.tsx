import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunForm } from "./RunForm";
import { failure, mockApi, renderPage } from "../../test/harness";
import { aDataset, aProvider, aRun, aSchema, page } from "../../test/factories";

const ready = {
  "GET /projects/p1/datasets": page([aDataset()]),
  "GET /projects/p1/schemas": page([aSchema()]),
  "GET /projects/p1/providers": page([aProvider()]),
};

function show(routes: Record<string, unknown> = ready, onCreated = vi.fn()) {
  const mock = mockApi(routes);
  renderPage(<RunForm projectId="p1" open onClose={vi.fn()} onCreated={onCreated} />);
  return { mock, onCreated };
}

describe("RunForm", () => {
  it("preselects the first usable dataset, schema, and provider", async () => {
    show();
    expect(await screen.findByLabelText(/Dataset/)).toHaveValue("d1");
    expect(screen.getByLabelText(/^Schema/)).toHaveValue("s1");
    expect(screen.getByLabelText(/Provider configuration/)).toHaveValue("pr1");
  });

  it("queues the run with the defaults it showed", async () => {
    const { mock, onCreated } = show({ ...ready, "POST /projects/p1/runs": aRun() });
    await screen.findByLabelText(/Dataset/);

    await userEvent.click(screen.getByRole("button", { name: "Start run" }));

    expect(mock.callsTo("POST /projects/p1/runs")[0].body).toMatchObject({
      dataset_id: "d1",
      schema_id: "s1",
      provider_configuration_id: "pr1",
      evaluation_options: { array_order: "ordered", numeric_tolerance: 0.01, case_sensitive: false },
    });
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "r1" }));
  });

  it("carries the evaluation options the reader changed", async () => {
    const { mock } = show({ ...ready, "POST /projects/p1/runs": aRun() });
    await screen.findByLabelText(/Dataset/);

    await userEvent.click(screen.getByRole("button", { name: "Show evaluation options" }));
    await userEvent.selectOptions(screen.getByLabelText(/Array comparison/), "unordered");
    await userEvent.click(screen.getByLabelText("Case sensitive strings"));
    await userEvent.click(screen.getByRole("button", { name: "Start run" }));

    expect(mock.callsTo("POST /projects/p1/runs")[0].body).toMatchObject({
      evaluation_options: { array_order: "unordered", case_sensitive: true },
    });
  });

  it("hides the advanced options again", async () => {
    show();
    await screen.findByLabelText(/Dataset/);

    await userEvent.click(screen.getByRole("button", { name: "Show evaluation options" }));
    await userEvent.click(screen.getByRole("button", { name: "Hide evaluation options" }));
    expect(screen.queryByLabelText(/Array comparison/)).toBeNull();
  });

  it("explains what is missing before a run is possible", async () => {
    show({ ...ready, "GET /projects/p1/schemas": page([aSchema({ active: false })]) });
    expect(await screen.findByText(/A run needs at least one dataset/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start run" })).toBeNull();
  });

  it("ignores providers without credentials", async () => {
    show({ ...ready, "GET /projects/p1/providers": page([aProvider({ available: false })]) });
    expect(await screen.findByText(/A run needs at least one dataset/)).toBeInTheDocument();
  });

  it("starts from the dataset the reader came from", async () => {
    mockApi({
      ...ready,
      "GET /projects/p1/datasets": page([aDataset(), aDataset({ id: "d2", name: "October invoices" })]),
    });
    renderPage(<RunForm projectId="p1" open initialDataset="d2" onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(await screen.findByLabelText(/Dataset/)).toHaveValue("d2");
  });

  it("loads nothing until it is opened", () => {
    const mock = mockApi(ready);
    renderPage(<RunForm projectId="p1" open={false} onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(mock.calls).toHaveLength(0);
  });

  it("keeps the dialog open and reports a refused run", async () => {
    const { onCreated } = show({
      ...ready,
      "POST /projects/p1/runs": failure(409, "DATASET_EMPTY", "That dataset has no ready documents."),
    });
    await screen.findByLabelText(/Dataset/);

    await userEvent.click(screen.getByRole("button", { name: "Start run" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That dataset has no ready documents.");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("closes without starting a run", async () => {
    const onClose = vi.fn();
    mockApi(ready);
    renderPage(<RunForm projectId="p1" open onClose={onClose} onCreated={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
