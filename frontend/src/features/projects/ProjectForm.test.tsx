import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectForm } from "./ProjectForm";
import { failure, mockApi, renderPage } from "../../test/harness";
import { aProject } from "../../test/factories";

describe("ProjectForm", () => {
  it("creates a project and hands it back", async () => {
    const mock = mockApi({ "POST /projects": aProject({ id: "p9", name: "Receipts" }) });
    const onSaved = vi.fn();
    renderPage(<ProjectForm onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText("Project name"), "Receipts");
    await userEvent.type(screen.getByLabelText("Description"), "Coffee receipts.");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(mock.callsTo("POST /projects")[0].body)
      .toEqual({ name: "Receipts", description: "Coffee receipts." });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "p9" }));
  });

  it("edits an existing project without changing its archive state", async () => {
    const project = aProject({ archived: true });
    const mock = mockApi({ "PUT /projects/p1": project });
    renderPage(<ProjectForm project={project} onSaved={vi.fn()} />);

    await userEvent.clear(screen.getByLabelText("Project name"));
    await userEvent.type(screen.getByLabelText("Project name"), "Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Save project" }));

    expect(mock.callsTo("PUT /projects/p1")[0].body).toMatchObject({ name: "Renamed", archived: true });
  });

  it("keeps the form open and explains a rejected name", async () => {
    mockApi({ "POST /projects": failure(409, "DUPLICATE_NAME", "You already have a project with that name.") });
    const onSaved = vi.fn();
    renderPage(<ProjectForm onSaved={onSaved} />);

    await userEvent.type(screen.getByLabelText("Project name"), "Invoice benchmark");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You already have a project with that name.");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("offers cancel only when the owner can close the form", async () => {
    mockApi();
    const onCancel = vi.fn();
    const { rerender } = renderPage(<ProjectForm onSaved={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();

    rerender(<ProjectForm onSaved={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
