import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GroundTruthEditor } from "./GroundTruthEditor";
import { failure, mockApi, renderPage } from "../../test/harness";
import { aGroundTruth, aSchema, page } from "../../test/factories";

const routes = {
  "GET /projects/p1/schemas": page([aSchema()]),
  "GET /documents/doc1/ground-truth": [aGroundTruth()],
};

const show = (disabled = false) =>
  renderPage(<GroundTruthEditor projectId="p1" documentId="doc1" disabled={disabled} />);

describe("GroundTruthEditor", () => {
  it("loads the existing annotation for the first schema", async () => {
    mockApi(routes);
    show();

    expect(await screen.findByText("Revision 3 · manual")).toBeInTheDocument();
    expect(screen.getByLabelText("Trusted JSON")).toHaveValue('{\n  "total": 120.5,\n  "vendor": "Acme"\n}');
  });

  it("starts empty when the document has never been annotated", async () => {
    mockApi({ ...routes, "GET /documents/doc1/ground-truth": [] });
    show();

    expect(await screen.findByText("No annotation yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Trusted JSON")).toHaveValue("{}");
  });

  it("saves a revision against the version it started from", async () => {
    const mock = mockApi({ ...routes, "PUT /documents/doc1/ground-truth": aGroundTruth({ version: 4 }) });
    show();
    await screen.findByText("Revision 3 · manual");

    await userEvent.clear(screen.getByLabelText("Trusted JSON"));
    await userEvent.type(screen.getByLabelText("Trusted JSON"), '{{"total": 121}');
    await userEvent.click(screen.getByRole("button", { name: "Save ground truth" }));

    expect(await screen.findByText(/Ground truth saved/)).toBeInTheDocument();
    expect(mock.callsTo("PUT /documents/doc1/ground-truth")[0].body).toEqual({
      schema_id: "s1", value: { total: 121 }, expected_version: 3, source: "manual",
    });
  });

  it("refuses to save while the JSON is broken", async () => {
    mockApi(routes);
    show();
    await screen.findByText("Revision 3 · manual");

    await userEvent.clear(screen.getByLabelText("Trusted JSON"));
    await userEvent.type(screen.getByLabelText("Trusted JSON"), "{{");

    expect(screen.getByRole("button", { name: "Save ground truth" })).toBeDisabled();
  });

  it("reports a rejected annotation from the server", async () => {
    mockApi({
      ...routes,
      "PUT /documents/doc1/ground-truth": failure(409, "VERSION_CONFLICT", "Someone else saved a newer revision."),
    });
    show();
    await screen.findByText("Revision 3 · manual");

    await userEvent.click(screen.getByRole("button", { name: "Save ground truth" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else saved a newer revision.");
  });

  it("imports a JSON file into the editor", async () => {
    mockApi(routes);
    show();
    await screen.findByText("Revision 3 · manual");

    const file = new File(['{"total": 99}'], "truth.json", { type: "application/json" });
    await userEvent.upload(document.querySelector("input[type=file]") as HTMLInputElement, file);

    await waitFor(() => expect(screen.getByLabelText("Trusted JSON"))
      .toHaveValue('{\n  "total": 99\n}'));
  });

  it("rejects an import that is not JSON", async () => {
    mockApi(routes);
    show();
    await screen.findByText("Revision 3 · manual");

    const file = new File(["not json"], "truth.json", { type: "application/json" });
    await userEvent.upload(document.querySelector("input[type=file]") as HTMLInputElement, file);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("asks for a schema before any annotation can be made", async () => {
    mockApi({ ...routes, "GET /projects/p1/schemas": page([]) });
    show();

    expect(await screen.findByText("Create a schema first")).toBeInTheDocument();
    expect(screen.queryByLabelText("Trusted JSON")).toBeNull();
  });

  it("locks editing for an archived project", async () => {
    mockApi(routes);
    show(true);

    expect(await screen.findByRole("button", { name: "Save ground truth" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Import JSON/ })).toBeDisabled();
  });

  it("offers a retry when the annotations cannot be loaded", async () => {
    mockApi({ ...routes, "GET /documents/doc1/ground-truth": failure(500, "SERVER_ERROR", "Annotations are unavailable.") });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("Annotations are unavailable.");
  });
});
