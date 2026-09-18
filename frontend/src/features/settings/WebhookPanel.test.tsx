import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WebhookPanel } from "./WebhookPanel";
import { failure, mockApi, renderPage } from "../../test/harness";
import { aDelivery, aWebhook, page, someSettings } from "../../test/factories";

const show = (settings = someSettings()) =>
  renderPage(<WebhookPanel projectId="p1" settings={settings} />);

describe("WebhookPanel", () => {
  it("lists the configured destinations and the hosts the server permits", async () => {
    mockApi({ "GET /projects/p1/webhooks": page([aWebhook()]) });
    show();

    expect(await screen.findByText("Run notifications")).toBeInTheDocument();
    expect(screen.getByText("https://hooks.example.com/receive")).toBeInTheDocument();
    expect(screen.getByText("Allowed hosts: hooks.example.com")).toBeInTheDocument();
  });

  it("explains how to switch delivery on when it is disabled", async () => {
    mockApi({ "GET /projects/p1/webhooks": page([]) });
    show(someSettings({ webhook_enabled: false }));

    expect(await screen.findByText("Webhook delivery is disabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add webhook/ })).toBeDisabled();
  });

  it("adds a webhook for the chosen events", async () => {
    const mock = mockApi({
      "GET /projects/p1/webhooks": page([]),
      "POST /projects/p1/webhooks": aWebhook({ id: "w9" }),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Add webhook/ }));
    const dialog = screen.getByRole("dialog", { name: "Add webhook" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Run notifications");
    await userEvent.type(within(dialog).getByLabelText(/Destination URL/), "hooks.example.com/receive");
    await userEvent.click(within(dialog).getByLabelText("Run Failed"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save webhook" }));

    expect(await screen.findByText("Webhook created.")).toBeInTheDocument();
    expect(mock.callsTo("POST /projects/p1/webhooks")[0].body).toMatchObject({
      name: "Run notifications",
      url: "https://hooks.example.com/receive",
      events: ["run.completed", "run.failed"],
    });
  });

  it("refuses to save a webhook with no events", async () => {
    mockApi({ "GET /projects/p1/webhooks": page([aWebhook()]) });
    show();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog", { name: "Edit webhook" });
    await userEvent.click(within(dialog).getByLabelText("Run Completed"));

    expect(within(dialog).getByText("Select at least one event.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save webhook" })).toBeDisabled();
  });

  it("updates an existing webhook", async () => {
    const mock = mockApi({
      "GET /projects/p1/webhooks": page([aWebhook()]),
      "PUT /projects/p1/webhooks/w1": aWebhook({ active: false }),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog", { name: "Edit webhook" });
    await userEvent.click(within(dialog).getByLabelText("Deliver events"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save webhook" }));

    expect(await screen.findByText("Webhook updated.")).toBeInTheDocument();
    expect(mock.callsTo("PUT /projects/p1/webhooks/w1")[0].body).toMatchObject({ active: false });
  });

  it("shows the delivery history on request", async () => {
    mockApi({
      "GET /projects/p1/webhooks": page([aWebhook()]),
      "GET /projects/p1/webhooks/w1/deliveries": page([aDelivery()]),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: "Deliveries" }));
    const deliveries = within((await screen.findAllByRole("table"))[1]);
    expect(deliveries.getByRole("cell", { name: "run.completed" })).toBeInTheDocument();
    expect(deliveries.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "200" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByRole("cell", { name: "200" })).toBeNull();
  });

  it("says when a webhook has never been delivered", async () => {
    mockApi({
      "GET /projects/p1/webhooks": page([aWebhook()]),
      "GET /projects/p1/webhooks/w1/deliveries": page([]),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: "Deliveries" }));
    expect(await screen.findByText("No deliveries attempted yet.")).toBeInTheDocument();
  });

  it("surfaces a failed delivery attempt", async () => {
    mockApi({
      "GET /projects/p1/webhooks": page([aWebhook()]),
      "GET /projects/p1/webhooks/w1/deliveries": page([aDelivery({
        status: "failed", attempts: 3, last_status_code: 500, last_error: "Destination returned 500.",
      })]),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: "Deliveries" }));
    expect(await screen.findByText("Destination returned 500.")).toBeInTheDocument();
  });

  it("explains the empty state", async () => {
    mockApi({ "GET /projects/p1/webhooks": page([]) });
    show();
    expect(await screen.findByRole("heading", { name: "No webhooks configured" })).toBeInTheDocument();
  });

  it("reports a rejected destination", async () => {
    mockApi({
      "GET /projects/p1/webhooks": page([]),
      "POST /projects/p1/webhooks": failure(422, "WEBHOOK_HOST_NOT_ALLOWED", "That host is not permitted."),
    });
    show();

    await userEvent.click(await screen.findByRole("button", { name: /Add webhook/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "Elsewhere");
    await userEvent.type(within(dialog).getByLabelText(/Destination URL/), "elsewhere.example.com/x");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save webhook" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That host is not permitted.");
  });
});
