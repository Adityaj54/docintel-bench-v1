import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectsPage } from "./ProjectsPage";
import { failure, mockApi, renderWithSession, waitForPath } from "../../test/harness";
import { aProject, page } from "../../test/factories";

const show = () => renderWithSession(<ProjectsPage />, { route: "/projects" });

describe("ProjectsPage", () => {
  it("lists the projects with their latest update", async () => {
    mockApi({ "GET /projects": page([aProject(), aProject({ id: "p2", name: "Receipts", archived: true })]) });
    show();

    expect(await screen.findByRole("heading", { name: "Invoice benchmark" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Receipts/ })).toHaveAttribute("href", "/projects/p2");
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });

  it("stands in for a project with no description", async () => {
    mockApi({ "GET /projects": page([aProject({ description: "" })]) });
    show();
    expect(await screen.findByText("No description yet.")).toBeInTheDocument();
  });

  it("invites the first project when there are none", async () => {
    mockApi({ "GET /projects": page([]) });
    show();
    expect(await screen.findByRole("heading", { name: "Create your first project" })).toBeInTheDocument();
  });

  it("asks the server to search rather than filtering on screen", async () => {
    const mock = mockApi({ "GET /projects": page([aProject()]) });
    show();
    await screen.findByRole("heading", { name: "Invoice benchmark" });

    await userEvent.type(screen.getByLabelText("Search projects"), "rec");
    await waitFor(() => expect(mock.calls.some(call => call.url.includes("search=rec"))).toBe(true));
  });

  it("switches between active and archived projects", async () => {
    const mock = mockApi({ "GET /projects": page([aProject()]) });
    show();
    await screen.findByRole("heading", { name: "Invoice benchmark" });

    await userEvent.selectOptions(screen.getByLabelText("Project archive filter"), "true");
    await waitFor(() => expect(mock.calls.some(call => call.url.includes("archived=true"))).toBe(true));
  });

  it("creates a project from the dialog and opens it", async () => {
    mockApi({
      "GET /projects": page([aProject()]),
      "POST /projects": aProject({ id: "p9", name: "Receipts" }),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /New project/ }));
    await userEvent.type(screen.getByLabelText("Project name"), "Receipts");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("Project created.")).toBeInTheDocument();
    await waitForPath("/projects/p9");
  });

  it("offers a retry when the list cannot be loaded", async () => {
    mockApi({ "GET /projects": failure(500, "SERVER_ERROR", "The list is unavailable.") });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("The list is unavailable.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("pages through a long list", async () => {
    const mock = mockApi({
      "GET /projects": page([aProject()], { total: 30, limit: 12 }),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Next/ }));
    await waitFor(() => expect(mock.calls.some(call => call.url.includes("offset=12"))).toBe(true));
  });

  it("signs the user out from the header", async () => {
    const mock = mockApi({ "GET /projects": page([]), "POST /auth/logout": undefined });
    show();
    await userEvent.click(await screen.findByRole("button", { name: /Sign out/ }));
    expect(mock.callsTo("POST /auth/logout")).toHaveLength(1);
  });
});
