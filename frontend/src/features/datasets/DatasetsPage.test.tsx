import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatasetsPage } from "./DatasetsPage";
import { failure, mockApi, renderInProject, waitForPath } from "../../test/harness";
import { aDataset, aProject, page } from "../../test/factories";

describe("DatasetsPage", () => {
  it("lists datasets with their document counts", async () => {
    mockApi({ "GET /projects/p1/datasets": page([aDataset()]) });
    renderInProject(<DatasetsPage />);

    expect(await screen.findByRole("link", { name: /September invoices/ }))
      .toHaveAttribute("href", "/projects/p1/datasets/d1");
    expect(screen.getByRole("cell", { name: "3" })).toBeInTheDocument();
  });

  it("invites a first dataset when the project is empty", async () => {
    mockApi({ "GET /projects/p1/datasets": page([]) });
    renderInProject(<DatasetsPage />);
    expect(await screen.findByRole("heading", { name: "No datasets yet" })).toBeInTheDocument();
  });

  it("creates a dataset and opens it", async () => {
    mockApi({
      "GET /projects/p1/datasets": page([]),
      "POST /projects/p1/datasets": aDataset({ id: "d9", name: "October invoices" }),
    });
    renderInProject(<DatasetsPage />);

    await userEvent.click(await screen.findByRole("button", { name: /New dataset/ }));
    await userEvent.type(screen.getByLabelText("Dataset name"), "October invoices");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create dataset" }));

    expect(await screen.findByText("Dataset created.")).toBeInTheDocument();
    await waitForPath("/projects/p1/datasets/d9");
  });

  it("blocks new datasets in an archived project", async () => {
    mockApi({
      "GET /projects/p1": aProject({ archived: true }),
      "GET /projects/p1/datasets": page([aDataset()]),
    });
    renderInProject(<DatasetsPage />);
    expect(await screen.findByRole("button", { name: /New dataset/ })).toBeDisabled();
  });

  it("offers a retry when the list fails", async () => {
    mockApi({ "GET /projects/p1/datasets": failure(500, "SERVER_ERROR", "Datasets are unavailable.") });
    renderInProject(<DatasetsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Datasets are unavailable.");
  });
});
