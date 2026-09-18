import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPage } from "./SettingsPage";
import { failure, mockApi, renderInProject, waitForPath } from "../../test/harness";
import { aProject, page, someSettings } from "../../test/factories";

const routes = {
  "GET /settings": someSettings(),
  "GET /projects/p1/providers": page([]),
  "GET /projects/p1/webhooks": page([]),
};

const show = () => renderInProject(<SettingsPage />, { path: "settings", route: "/projects/p1/settings" });

describe("SettingsPage", () => {
  it("saves the project details", async () => {
    const mock = mockApi({ ...routes, "PUT /projects/p1": aProject({ name: "Renamed" }) });
    show();

    const name = await screen.findByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Renamed");
    await userEvent.click(screen.getByRole("button", { name: "Save details" }));

    expect(await screen.findByText("Project details saved.")).toBeInTheDocument();
    expect(mock.callsTo("PUT /projects/p1")[0].body).toMatchObject({ name: "Renamed", archived: false });
  });

  it("archives the project and leaves the workspace", async () => {
    const mock = mockApi({ ...routes, "PUT /projects/p1": aProject({ archived: true }) });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Archive project/ }));

    expect(await screen.findByText("Project archived.")).toBeInTheDocument();
    expect(mock.callsTo("PUT /projects/p1")[0].body).toMatchObject({ archived: true });
    await waitForPath("/projects");
  });

  it("restores an archived project without navigating away", async () => {
    const mock = mockApi({
      ...routes,
      "GET /projects/p1": aProject({ archived: true }),
      "PUT /projects/p1": aProject({ archived: false }),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Restore project/ }));

    expect(await screen.findByText("Project restored.")).toBeInTheDocument();
    expect(mock.callsTo("PUT /projects/p1")[0].body).toMatchObject({ archived: false });
    await waitForPath("/projects/p1/settings");
  });

  it("locks the details form while the project is archived", async () => {
    mockApi({ ...routes, "GET /projects/p1": aProject({ archived: true }) });
    show();

    expect(await screen.findByLabelText("Name")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save details" })).toBeDisabled();
  });

  it("reports the limits this deployment enforces", async () => {
    mockApi(routes);
    show();

    expect(await screen.findByText("Local")).toBeInTheDocument();
    expect(screen.getByText("25.0 MB")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Mock")).toBeInTheDocument();
  });

  it("says plainly when no provider has credentials", async () => {
    mockApi({ ...routes, "GET /settings": someSettings({ providers: { mock: false, openai: false } }) });
    show();
    expect(await screen.findByText("None")).toBeInTheDocument();
  });

  it("reports a refused save", async () => {
    mockApi({ ...routes, "PUT /projects/p1": failure(409, "DUPLICATE_NAME", "That name is already used.") });
    show();

    await userEvent.click(await screen.findByRole("button", { name: "Save details" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That name is already used.");
  });
});
