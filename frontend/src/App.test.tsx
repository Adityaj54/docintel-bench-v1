import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { App } from "./App";
import { failure, mockApi, renderWithSession, waitForPath } from "./test/harness";
import { page } from "./test/factories";

const signedOut = { "GET /auth/me": failure(401, "NOT_AUTHENTICATED") };

describe("App", () => {
  it("sends the root path to the project list", async () => {
    mockApi({ "GET /projects": page([]) });
    renderWithSession(<App />, { route: "/" });
    await waitForPath("/projects");
  });

  it("waits for the session before deciding where to send the visitor", () => {
    mockApi({ "GET /projects": page([]) });
    renderWithSession(<App />, { route: "/projects" });
    expect(screen.getByRole("status")).toHaveTextContent("Restoring your session…");
  });

  it("sends a signed-out visitor to the sign-in page", async () => {
    mockApi(signedOut);
    renderWithSession(<App />, { route: "/projects" });
    await waitForPath("/login");
  });

  it("offers a retry when the session could not be loaded at all", async () => {
    mockApi({ "GET /auth/me": failure(503, "UNAVAILABLE", "The API is restarting.") });
    renderWithSession(<App />, { route: "/projects" });
    expect(await screen.findByRole("alert")).toHaveTextContent("The API is restarting.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("explains an unknown address instead of showing a blank page", async () => {
    mockApi();
    renderWithSession(<App />, { route: "/projects/p1/nowhere" });
    expect(await screen.findByRole("heading", { name: "That page does not exist" })).toBeInTheDocument();
  });

  it("shows the sign-in page to a signed-out visitor at /login", async () => {
    mockApi(signedOut);
    renderWithSession(<App />, { route: "/login" });
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });
});
