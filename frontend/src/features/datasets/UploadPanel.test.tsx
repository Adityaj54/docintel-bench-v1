import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadPanel } from "./UploadPanel";
import { failure, mockApi, renderPage } from "../../test/harness";
import { aDocument } from "../../test/factories";

const file = (name = "invoice.pdf") => new File(["%PDF-1.7"], name, { type: "application/pdf" });

function show(onUploaded = vi.fn(), disabled = false) {
  renderPage(<UploadPanel datasetId="d1" onUploaded={onUploaded} disabled={disabled} />);
  return onUploaded;
}

describe("UploadPanel", () => {
  it("uploads each chosen file and reports it upward", async () => {
    const mock = mockApi({ "POST /datasets/d1/documents": aDocument() });
    const onUploaded = show();

    await userEvent.upload(document.querySelector("input[type=file]") as HTMLInputElement,
      [file("one.pdf"), file("two.pdf")]);

    expect(await screen.findAllByText("Uploaded · preprocessing queued")).toHaveLength(2);
    expect(mock.callsTo("POST /datasets/d1/documents")).toHaveLength(2);
    expect(onUploaded).toHaveBeenCalledTimes(2);
  });

  it("sends the file as multipart form data", async () => {
    const mock = mockApi({ "POST /datasets/d1/documents": aDocument() });
    show();

    await userEvent.upload(document.querySelector("input[type=file]") as HTMLInputElement, file());

    const body = mock.callsTo("POST /datasets/d1/documents")[0].body;
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("keeps a rejected file visible with the server's reason", async () => {
    mockApi({ "POST /datasets/d1/documents": failure(415, "UNSUPPORTED_TYPE", "That file type is not supported.") });
    show();

    await userEvent.upload(document.querySelector("input[type=file]") as HTMLInputElement, file("notes.pdf"));

    expect(await screen.findByText("That file type is not supported.")).toBeInTheDocument();
  });

  it("clears the history once the batch has settled", async () => {
    mockApi({ "POST /datasets/d1/documents": aDocument() });
    show();

    await userEvent.upload(document.querySelector("input[type=file]") as HTMLInputElement, file());
    await screen.findByText("Uploaded · preprocessing queued");
    await userEvent.click(screen.getByRole("button", { name: "Clear upload history" }));

    expect(screen.queryByText("invoice.pdf")).toBeNull();
  });

  it("accepts files dropped onto the zone", async () => {
    const mock = mockApi({ "POST /datasets/d1/documents": aDocument() });
    show();
    const dropzone = screen.getByRole("button", { name: /Drop documents here/ });

    fireEvent.dragOver(dropzone);
    expect(dropzone).toHaveClass("dragging");
    fireEvent.drop(dropzone, { dataTransfer: { files: [file()] } });

    expect(await screen.findByText("Uploaded · preprocessing queued")).toBeInTheDocument();
    expect(mock.callsTo("POST /datasets/d1/documents")).toHaveLength(1);
  });

  it("stops highlighting when the drag leaves", () => {
    mockApi();
    show();
    const dropzone = screen.getByRole("button", { name: /Drop documents here/ });

    fireEvent.dragOver(dropzone);
    fireEvent.dragLeave(dropzone);
    expect(dropzone).not.toHaveClass("dragging");
  });

  it("refuses uploads to an archived project", async () => {
    const mock = mockApi({ "POST /datasets/d1/documents": aDocument() });
    show(vi.fn(), true);
    const dropzone = screen.getByRole("button", { name: /Drop documents here/ });

    expect(dropzone).toBeDisabled();
    fireEvent.drop(dropzone, { dataTransfer: { files: [file()] } });
    expect(mock.calls).toHaveLength(0);
  });
});
