import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatasetDetail } from "./DatasetDetail";
import { failure, mockApi, renderInProject } from "../../test/harness";
import { aDataset, aDocument, page } from "../../test/factories";

const routes = {
  "GET /datasets/d1": aDataset(),
  "GET /datasets/d1/documents": page([aDocument()]),
};

const show = () => renderInProject(<DatasetDetail />, {
  path: "datasets/:datasetId",
  route: "/projects/p1/datasets/d1",
});

describe("DatasetDetail", () => {
  it("describes the dataset and its documents", async () => {
    mockApi(routes);
    show();

    expect(await screen.findByRole("heading", { name: "September invoices", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /invoice-104.pdf/ }))
      .toHaveAttribute("href", "/projects/p1/documents/doc1");
    expect(screen.getByText("24.0 KB")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Ready")).toBeInTheDocument();
  });

  it("filters documents on the server", async () => {
    const mock = mockApi(routes);
    show();
    await screen.findByRole("link", { name: /invoice-104.pdf/ });

    await userEvent.selectOptions(screen.getByLabelText("Document status"), "failed");
    await waitFor(() => expect(mock.calls.some(call => call.url.includes("status=failed"))).toBe(true));

    await userEvent.type(screen.getByLabelText("Search documents"), "104");
    await waitFor(() => expect(mock.calls.some(call => call.url.includes("search=104"))).toBe(true));
  });

  it("suggests widening the filters when nothing matches", async () => {
    mockApi({ ...routes, "GET /datasets/d1/documents": page([]) });
    show();
    expect(await screen.findByRole("heading", { name: "No documents found" })).toBeInTheDocument();
  });

  it("renames the dataset from the edit dialog", async () => {
    const mock = mockApi({ ...routes, "PUT /datasets/d1": aDataset({ name: "Renamed" }) });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Edit/ }));
    await userEvent.clear(screen.getByLabelText("Dataset name"));
    await userEvent.type(screen.getByLabelText("Dataset name"), "Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Save dataset" }));

    expect(await screen.findByText("Dataset updated.")).toBeInTheDocument();
    expect(mock.callsTo("PUT /datasets/d1")[0].body).toMatchObject({ name: "Renamed" });
  });

  it("links straight to a run over this dataset", async () => {
    mockApi(routes);
    show();
    expect(await screen.findByRole("link", { name: /Run extraction/ }))
      .toHaveAttribute("href", "/projects/p1/runs?new=1&dataset=d1");
  });

  it("reports a dataset that cannot be loaded", async () => {
    mockApi({ ...routes, "GET /datasets/d1": failure(404, "NOT_FOUND", "That dataset was removed.") });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("That dataset was removed.");
  });
});
