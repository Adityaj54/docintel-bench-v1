import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderPanel } from "./ProviderPanel";
import { failure, mockApi, renderPage } from "../../test/harness";
import { aProvider, page, someSettings } from "../../test/factories";

const show = (settings = someSettings()) =>
  renderPage(<ProviderPanel projectId="p1" settings={settings} />);

describe("ProviderPanel", () => {
  it("lists each configuration with its pricing and state", async () => {
    mockApi({ "GET /projects/p1/providers": page([aProvider()]) });
    show();

    expect(await screen.findByText("Mock baseline")).toBeInTheDocument();
    expect(screen.getByText("mock-extract-1")).toBeInTheDocument();
    expect(screen.getByText(/\$1\.50 in · \$6\.00 out/)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("flags a configuration whose credentials are missing", async () => {
    mockApi({ "GET /projects/p1/providers": page([aProvider({ provider: "openai", available: false })]) });
    show();
    expect(await screen.findByText("Credentials missing")).toBeInTheDocument();
  });

  it("adds a configuration", async () => {
    const mock = mockApi({
      "GET /projects/p1/providers": page([]),
      "POST /projects/p1/providers": aProvider({ id: "pr9" }),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Add configuration/ }));
    const dialog = screen.getByRole("dialog", { name: "Add provider configuration" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Mock baseline");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save configuration" }));

    expect(await screen.findByText("Provider configuration created.")).toBeInTheDocument();
    expect(mock.callsTo("POST /projects/p1/providers")[0].body).toMatchObject({
      name: "Mock baseline", provider: "mock", model: "mock-extract-1", active: true,
    });
  });

  it("edits an existing configuration in place", async () => {
    const mock = mockApi({
      "GET /projects/p1/providers": page([aProvider()]),
      "PUT /providers/pr1": aProvider({ active: false }),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog", { name: "Edit provider configuration" });
    await userEvent.click(within(dialog).getByLabelText("Available for new runs"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save configuration" }));

    expect(await screen.findByText("Provider configuration updated.")).toBeInTheDocument();
    expect(mock.callsTo("PUT /providers/pr1")[0].body).toMatchObject({ active: false });
  });

  it("shows the mock scenario options only for the mock provider", async () => {
    mockApi({ "GET /projects/p1/providers": page([]) });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Add configuration/ }));
    expect(screen.getByLabelText(/Scenario/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/Provider/), "openai");
    expect(screen.queryByLabelText(/Scenario/)).toBeNull();
  });

  it("warns that a provider has no API key configured", async () => {
    mockApi({ "GET /projects/p1/providers": page([]) });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Add configuration/ }));
    await userEvent.selectOptions(screen.getByLabelText(/Provider/), "anthropic");
    expect(screen.getByText(/No API key is configured for this provider/)).toBeInTheDocument();
  });

  it("explains the empty state before any configuration exists", async () => {
    mockApi({ "GET /projects/p1/providers": page([]) });
    show();
    expect(await screen.findByRole("heading", { name: "No provider configurations" })).toBeInTheDocument();
  });

  it("reports a rejected configuration", async () => {
    mockApi({
      "GET /projects/p1/providers": page([]),
      "POST /projects/p1/providers": failure(422, "INVALID_MODEL", "That model name is not allowed."),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Add configuration/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "Broken");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save configuration" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That model name is not allowed.");
  });

  it("offers a retry when the configurations cannot be loaded", async () => {
    mockApi({ "GET /projects/p1/providers": failure(500, "SERVER_ERROR", "Providers are unavailable.") });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("Providers are unavailable.");
  });
});
