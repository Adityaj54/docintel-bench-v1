import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemasPage } from "./SchemasPage";
import { failure, mockApi, renderInProject } from "../../test/harness";
import { aProject, aSchema, page } from "../../test/factories";

describe("SchemasPage", () => {
  it("lists each schema with its version and state", async () => {
    mockApi({ "GET /projects/p1/schemas": page([aSchema(), aSchema({ id: "s2", name: "Receipt", version: 1, active: false })]) });
    renderInProject(<SchemasPage />);

    expect(await screen.findByRole("link", { name: /Invoice/ })).toHaveAttribute("href", "/projects/p1/schemas/s1");
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("deactivates a schema without leaving the page", async () => {
    const mock = mockApi({
      "GET /projects/p1/schemas": page([aSchema()]),
      "PUT /schemas/s1/activation": aSchema({ active: false }),
    });
    renderInProject(<SchemasPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Deactivate" }));

    expect(await screen.findByText("Schema activation updated.")).toBeInTheDocument();
    expect(mock.callsTo("PUT /schemas/s1/activation")[0].body).toEqual({ active: false });
  });

  it("clones a schema under a new name", async () => {
    const mock = mockApi({
      "GET /projects/p1/schemas": page([aSchema()]),
      "POST /schemas/s1/clone": aSchema({ id: "s9", name: "Invoice copy", version: 1 }),
    });
    renderInProject(<SchemasPage />);

    await userEvent.click(await screen.findByRole("button", { name: /Clone/ }));
    const dialog = screen.getByRole("dialog", { name: "Clone schema" });
    expect(within(dialog).getByLabelText("New schema name")).toHaveValue("Invoice copy");
    await userEvent.click(within(dialog).getByRole("button", { name: "Clone schema" }));

    expect(await screen.findByText("Schema cloned.")).toBeInTheDocument();
    expect(mock.callsTo("POST /schemas/s1/clone")[0].body).toEqual({ name: "Invoice copy" });
  });

  it("reports a refused activation change", async () => {
    mockApi({
      "GET /projects/p1/schemas": page([aSchema()]),
      "PUT /schemas/s1/activation": failure(409, "SCHEMA_IN_USE", "A running run still uses this schema."),
    });
    renderInProject(<SchemasPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("A running run still uses this schema.");
  });

  it("invites a first schema when there are none", async () => {
    mockApi({ "GET /projects/p1/schemas": page([]) });
    renderInProject(<SchemasPage />);
    expect(await screen.findByRole("heading", { name: "Define your first schema" })).toBeInTheDocument();
  });

  it("locks editing actions for an archived project", async () => {
    mockApi({
      "GET /projects/p1": aProject({ archived: true }),
      "GET /projects/p1/schemas": page([aSchema()]),
    });
    renderInProject(<SchemasPage />);

    expect(await screen.findByRole("button", { name: /Clone/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeDisabled();
  });
});
