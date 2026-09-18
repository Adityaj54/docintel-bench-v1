import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaEditor } from "./SchemaEditor";
import { failure, mockApi, renderInProject, waitForPath } from "../../test/harness";
import { aProject, aSchema, aValidationReport } from "../../test/factories";

const showNew = () => renderInProject(<SchemaEditor />, {
  path: "schemas/new",
  route: "/projects/p1/schemas/new",
});

const showExisting = () => renderInProject(<SchemaEditor />, {
  path: "schemas/:schemaId",
  route: "/projects/p1/schemas/s1",
});

describe("SchemaEditor", () => {
  it("starts a new schema from the blank template", async () => {
    mockApi();
    showNew();

    expect(await screen.findByRole("heading", { name: "Create schema", level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText("JSON Schema")).toHaveValue(JSON.stringify({
      type: "object", properties: {}, required: [], additionalProperties: false,
    }, null, 2));
  });

  it("fills the definition from a template", async () => {
    mockApi();
    showNew();

    await userEvent.selectOptions(await screen.findByLabelText("Start from a template"), "Invoice");
    await waitFor(() => expect((screen.getByLabelText("JSON Schema") as HTMLTextAreaElement).value)
      .toContain("invoice_number"));
  });

  it("creates the schema and opens the saved version", async () => {
    const mock = mockApi({ "POST /projects/p1/schemas": aSchema({ id: "s9" }) });
    showNew();

    await userEvent.type(await screen.findByLabelText("Name"), "Invoice");
    await userEvent.click(screen.getByRole("button", { name: /Create schema/ }));

    expect(await screen.findByText("Schema created.")).toBeInTheDocument();
    expect(mock.callsTo("POST /projects/p1/schemas")[0].body).toMatchObject({ name: "Invoice" });
    await waitForPath("/projects/p1/schemas/s9");
  });

  it("saves an edit as a new version instead of overwriting", async () => {
    const mock = mockApi({
      "GET /schemas/s1": aSchema(),
      "POST /schemas/s1/versions": aSchema({ version: 3 }),
    });
    showExisting();

    expect(await screen.findByText("SCHEMA / VERSION 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /Save as new version/ }));
    expect(await screen.findByText("Schema version created.")).toBeInTheDocument();
    expect(mock.callsTo("POST /schemas/s1/versions")).toHaveLength(1);
  });

  it("refuses to save a definition that is not valid JSON", async () => {
    mockApi();
    showNew();

    const editor = await screen.findByLabelText("JSON Schema");
    await userEvent.clear(editor);
    await userEvent.type(editor, "{{");

    expect(screen.getByRole("button", { name: /Create schema/ })).toBeDisabled();
  });

  it("insists the definition is an object", async () => {
    mockApi();
    showNew();

    const editor = await screen.findByLabelText("JSON Schema");
    await userEvent.clear(editor);
    await userEvent.type(editor, "[[1]");

    expect(await screen.findByText("Use a JSON object as the schema definition.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create schema/ })).toBeDisabled();
  });

  it("validates a sample against the saved version", async () => {
    const mock = mockApi({
      "GET /schemas/s1": aSchema(),
      "POST /schemas/s1/validate": aValidationReport(),
    });
    showExisting();

    const sample = await screen.findByLabelText("Sample JSON");
    await userEvent.clear(sample);
    await userEvent.type(sample, '{{"total": "12,40"}');
    await userEvent.click(screen.getByRole("button", { name: "Validate sample" }));

    expect(await screen.findByText("1 validation issue(s)")).toBeInTheDocument();
    expect(mock.callsTo("POST /schemas/s1/validate")[0].body).toEqual({ value: { total: "12,40" } });
  });

  it("cannot validate a sample before the schema exists", async () => {
    mockApi();
    showNew();
    expect(await screen.findByRole("button", { name: "Validate sample" })).toBeDisabled();
  });

  it("reports a rejected definition from the server", async () => {
    mockApi({ "POST /projects/p1/schemas": failure(422, "INVALID_SCHEMA", "The definition is not valid JSON Schema.") });
    showNew();

    await userEvent.type(await screen.findByLabelText("Name"), "Invoice");
    await userEvent.click(screen.getByRole("button", { name: /Create schema/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The definition is not valid JSON Schema.");
  });

  it("locks saving in an archived project", async () => {
    mockApi({ "GET /projects/p1": aProject({ archived: true }), "GET /schemas/s1": aSchema() });
    showExisting();
    expect(await screen.findByRole("button", { name: /Save as new version/ })).toBeDisabled();
  });

  it("reports a schema that cannot be loaded", async () => {
    mockApi({ "GET /schemas/s1": failure(404, "NOT_FOUND", "That schema was removed.") });
    showExisting();
    expect(await screen.findByRole("alert")).toHaveTextContent("That schema was removed.");
  });
});
