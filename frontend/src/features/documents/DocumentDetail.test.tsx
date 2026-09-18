import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentDetail } from "./DocumentDetail";
import { failure, jsonResponse, mockApi, renderInProject, waitForPath } from "../../test/harness";
import { aDocument, aGroundTruth, aSchema, page } from "../../test/factories";

const routes = {
  "GET /documents/doc1": aDocument(),
  "GET /projects/p1/schemas": page([aSchema()]),
  "GET /documents/doc1/ground-truth": [aGroundTruth()],
};

const show = () => renderInProject(<DocumentDetail />, {
  path: "documents/:documentId",
  route: "/projects/p1/documents/doc1",
});

describe("DocumentDetail", () => {
  it("summarises the file and shows the first rendered page", async () => {
    mockApi(routes);
    show();

    expect(await screen.findByRole("heading", { name: "invoice-104.pdf", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("application/pdf · 24.0 KB · 2 page(s)")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "invoice-104.pdf page 1" })).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("pages through the rendered images", async () => {
    mockApi(routes);
    show();

    await userEvent.click(await screen.findByRole("button", { name: "Next page" }));
    expect(screen.getByRole("img", { name: "invoice-104.pdf page 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByRole("img", { name: "invoice-104.pdf page 1" })).toBeInTheDocument();
  });

  it("explains that a preview is still being prepared", async () => {
    mockApi({ ...routes, "GET /documents/doc1": aDocument({ artifacts: [], status: "processing" }) });
    show();
    expect(await screen.findByRole("heading", { name: "Preview is being prepared" })).toBeInTheDocument();
    expect(screen.getByText("0 / 0")).toBeInTheDocument();
  });

  it("offers a retry for a document that failed preprocessing", async () => {
    const mock = mockApi({
      ...routes,
      "GET /documents/doc1": aDocument({
        status: "failed",
        error: { code: "PDF_UNREADABLE", message: "The PDF could not be opened." },
      }),
      "POST /documents/doc1/retry": aDocument({ status: "queued" }),
    });
    show();

    expect(await screen.findByText("The PDF could not be opened.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Retry preprocessing/ }));

    expect(await screen.findByText("Preprocessing queued.")).toBeInTheDocument();
    expect(mock.callsTo("POST /documents/doc1/retry")).toHaveLength(1);
  });

  it("downloads the original file", async () => {
    const mock = mockApi({ ...routes, "GET /documents/doc1/original": jsonResponse({}) });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Original/ }));
    expect(mock.callsTo("GET /documents/doc1/original")).toHaveLength(1);
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it("deletes the document after confirmation and returns to the dataset", async () => {
    const mock = mockApi({ ...routes, "DELETE /documents/doc1": { message: "deleted" } });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Delete/ }));
    const dialog = screen.getByRole("dialog", { name: "Delete document?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete document" }));

    expect(await screen.findByText("Document deleted.")).toBeInTheDocument();
    expect(mock.callsTo("DELETE /documents/doc1")).toHaveLength(1);
    await waitForPath("/projects/p1/datasets/d1");
  });

  it("keeps the document when the reader backs out", async () => {
    const mock = mockApi(routes);
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Delete/ }));
    await userEvent.click(screen.getByRole("button", { name: "Keep document" }));

    expect(screen.queryByRole("button", { name: "Delete document" })).toBeNull();
    expect(mock.callsTo("DELETE /documents/doc1")).toHaveLength(0);
  });

  it("reports a document that cannot be loaded", async () => {
    mockApi({ ...routes, "GET /documents/doc1": failure(404, "NOT_FOUND", "That document was deleted.") });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("That document was deleted.");
  });
});
