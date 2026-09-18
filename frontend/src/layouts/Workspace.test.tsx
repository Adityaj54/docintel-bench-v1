import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { failure, mockApi, renderInProject } from "../test/harness";
import { aProject } from "../test/factories";

const child = <p>Workspace child</p>;

describe("Workspace", () => {
  it("names the project across the sidebar and breadcrumbs", async () => {
    mockApi();
    renderInProject(child);
    expect(await screen.findAllByText("Invoice benchmark")).toHaveLength(2);
    expect(screen.getByText("Workspace child")).toBeInTheDocument();
  });

  it("links to every area of the project", async () => {
    mockApi();
    renderInProject(child);
    const navigation = await screen.findByRole("navigation", { name: "Project navigation" });
    expect(navigation.querySelectorAll("a")).toHaveLength(8);
    expect(screen.getByRole("link", { name: "Metrics" })).toHaveAttribute("href", "/projects/p1/metrics");
  });

  it("identifies the signed-in user by their initials", async () => {
    mockApi();
    renderInProject(child);
    expect(await screen.findByText("AD")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  it("warns that an archived project is read-only", async () => {
    mockApi({ "GET /projects/p1": aProject({ archived: true }) });
    renderInProject(child);
    expect(await screen.findByText(/This project is archived/)).toBeInTheDocument();
  });

  it("offers a retry when the project cannot be loaded", async () => {
    mockApi({ "GET /projects/p1": failure(404, "NOT_FOUND", "That project no longer exists.") });
    renderInProject(child);
    expect(await screen.findByRole("alert")).toHaveTextContent("That project no longer exists.");
    expect(screen.queryByText("Workspace child")).toBeNull();
  });

  it("signs the user out from the sidebar", async () => {
    const mock = mockApi({ "POST /auth/logout": undefined });
    renderInProject(child);
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(mock.callsTo("POST /auth/logout")).toHaveLength(1);
  });

  it("reports a failed sign-out rather than pretending it worked", async () => {
    mockApi({ "POST /auth/logout": failure(500, "SERVER_ERROR", "Sign-out failed.") });
    renderInProject(child);
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sign-out failed.");
  });

  it("opens and closes the navigation on a small screen", async () => {
    mockApi();
    const { container } = renderInProject(child);
    await screen.findByText("Workspace child");

    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(container.querySelector(".sidebar")).toHaveClass("open");

    const [scrim] = screen.getAllByRole("button", { name: "Close navigation" });
    await userEvent.click(scrim);
    expect(container.querySelector(".sidebar")).not.toHaveClass("open");
  });
});
