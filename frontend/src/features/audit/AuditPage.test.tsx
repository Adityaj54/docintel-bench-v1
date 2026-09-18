import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditPage } from "./AuditPage";
import { failure, mockApi, renderInProject } from "../../test/harness";
import { anAudit, page } from "../../test/factories";

const show = () => renderInProject(<AuditPage />, { path: "audit", route: "/projects/p1/audit" });

describe("AuditPage", () => {
  it("lists what changed, to what, and when", async () => {
    mockApi({ "GET /projects/p1/audit": page([anAudit()]) });
    show();

    expect(await screen.findByText("Schema.Created")).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Schema")).toBeInTheDocument();
    expect(table.getByText("de6decb8")).toBeInTheDocument();
  });

  it("opens and closes the recorded details", async () => {
    mockApi({ "GET /projects/p1/audit": page([anAudit()]) });
    show();

    await userEvent.click(await screen.findByRole("button", { name: "Show details" }));
    expect(screen.getByText("Audit details")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hide details" }));
    expect(screen.queryByText("Audit details")).toBeNull();
  });

  it("offers no details for an event that carries none", async () => {
    mockApi({ "GET /projects/p1/audit": page([anAudit({ details: {} })]) });
    show();

    await screen.findByText("Schema.Created");
    expect(screen.queryByRole("button", { name: "Show details" })).toBeNull();
  });

  it("filters by action and entity on the server", async () => {
    const mock = mockApi({ "GET /projects/p1/audit": page([anAudit()]) });
    show();
    await screen.findByText("Schema.Created");

    await userEvent.type(screen.getByPlaceholderText("Filter by action…"), "run");
    await waitFor(() => expect(mock.calls.some(call => call.url.includes("action=run"))).toBe(true));

    await userEvent.selectOptions(screen.getByLabelText("Entity"), "dataset");
    await waitFor(() => expect(mock.calls.some(call => call.url.includes("entity=dataset"))).toBe(true));
  });

  it("clears every filter at once", async () => {
    mockApi({ "GET /projects/p1/audit": page([anAudit()]) });
    show();
    await screen.findByText("Schema.Created");

    await userEvent.type(screen.getByPlaceholderText("Filter by action…"), "run");
    await userEvent.click(await screen.findByRole("button", { name: "Clear filters" }));

    expect(screen.getByPlaceholderText("Filter by action…")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("refuses a period that runs backwards", async () => {
    mockApi({ "GET /projects/p1/audit": page([anAudit()]) });
    show();
    await screen.findByText("Schema.Created");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-01" } });

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("The start date must come before the end date.");
  });

  it("pages through a long history", async () => {
    const mock = mockApi({ "GET /projects/p1/audit": page([anAudit()], { total: 60, limit: 25 }) });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Next/ }));
    await waitFor(() => expect(mock.calls.some(call => call.url.includes("offset=25"))).toBe(true));
  });

  it("suggests widening the filters when nothing matches", async () => {
    mockApi({ "GET /projects/p1/audit": page([]) });
    show();
    expect(await screen.findByRole("heading", { name: "No matching events" })).toBeInTheDocument();
  });

  it("offers a retry when the history cannot be loaded", async () => {
    mockApi({ "GET /projects/p1/audit": failure(500, "SERVER_ERROR", "The audit log is unavailable.") });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("The audit log is unavailable.");
  });
});
