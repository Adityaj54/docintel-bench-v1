import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthPage } from "./AuthPage";
import { failure, mockApi, renderWithSession, waitForPath } from "../../test/harness";
import { aSession } from "../../test/factories";

const signedOut = { "GET /auth/me": failure(401, "NOT_AUTHENTICATED") };

describe("AuthPage", () => {
  it("signs the user in and opens their projects", async () => {
    const mock = mockApi({ ...signedOut, "POST /auth/login": aSession() });
    renderWithSession(<AuthPage />, { route: "/login" });

    await userEvent.type(await screen.findByLabelText("Email address"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));

    expect(mock.callsTo("POST /auth/login")[0].body)
      .toEqual({ email: "ada@example.com", password: "correct horse battery" });
    await waitForPath("/projects");
  });

  it("registers a new workspace with a display name", async () => {
    const mock = mockApi({ ...signedOut, "POST /auth/register": aSession() });
    renderWithSession(<AuthPage register />, { route: "/register" });

    await userEvent.type(await screen.findByLabelText("Your name"), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText("Email address"), "ada@example.com");
    await userEvent.type(screen.getByLabelText(/^Password/), "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: /Create account/ }));

    expect(mock.callsTo("POST /auth/register")[0].body).toMatchObject({ display_name: "Ada Lovelace" });
  });

  it("asks for a longer password when registering", async () => {
    mockApi(signedOut);
    renderWithSession(<AuthPage register />, { route: "/register" });
    expect(await screen.findByLabelText(/^Password/)).toHaveAttribute("minlength", "12");
    expect(screen.getByText("At least 12 characters.")).toBeInTheDocument();
  });

  it("explains why the sign-in was refused", async () => {
    mockApi({ ...signedOut, "POST /auth/login": failure(401, "INVALID_CREDENTIALS", "Email or password is incorrect.") });
    renderWithSession(<AuthPage />, { route: "/login" });

    await userEvent.type(await screen.findByLabelText("Email address"), "ada@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
    await waitForPath("/login");
  });

  it("sends an already signed-in visitor to their projects", async () => {
    mockApi();
    renderWithSession(<AuthPage />, { route: "/login" });
    await waitForPath("/projects");
  });

  it("links to the other side of the form", async () => {
    mockApi(signedOut);
    renderWithSession(<AuthPage />, { route: "/login" });
    expect(await screen.findByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/register");
  });
});
