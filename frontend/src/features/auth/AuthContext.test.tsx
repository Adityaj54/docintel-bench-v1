import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthContext";
import { api } from "../../api/client";
import { failure, mockApi } from "../../test/harness";
import { aSession } from "../../test/factories";

function Probe() {
  const auth = useAuth();
  if (auth.loading) return <p>Restoring…</p>;
  return <div>
    <p>{auth.user ? auth.user.display_name : "Signed out"}</p>
    {auth.error && <p role="alert">{auth.error.message}</p>}
    <button onClick={() => void auth.logout()}>Sign out</button>
    <button onClick={auth.reload}>Reload</button>
  </div>;
}

const show = () => render(<AuthProvider><Probe /></AuthProvider>);

describe("AuthProvider", () => {
  it("restores the signed-in user", async () => {
    mockApi();
    show();
    expect(screen.getByText("Restoring…")).toBeInTheDocument();
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("treats a rejected session as simply signed out", async () => {
    mockApi({ "GET /auth/me": failure(401, "NOT_AUTHENTICATED") });
    show();
    expect(await screen.findByText("Signed out")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("surfaces a real failure so the shell can offer a retry", async () => {
    mockApi({ "GET /auth/me": failure(503, "UNAVAILABLE", "The API is restarting.") });
    show();
    expect(await screen.findByRole("alert")).toHaveTextContent("The API is restarting.");
  });

  it("refetches the session on demand", async () => {
    let name = "Ada Lovelace";
    const mock = mockApi({ "GET /auth/me": () => aSession({ display_name: name }) });
    show();
    await screen.findByText("Ada Lovelace");

    name = "Ada L.";
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(await screen.findByText("Ada L.")).toBeInTheDocument();
    expect(mock.callsTo("GET /auth/me")).toHaveLength(2);
  });

  it("signs the user out and forgets the CSRF token", async () => {
    const mock = mockApi({ "POST /auth/logout": undefined, "GET /projects": [] });
    show();
    await screen.findByText("Ada Lovelace");

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Signed out")).toBeInTheDocument();

    await api("/projects").catch(() => undefined);
    expect(mock.callsTo("POST /auth/logout")).toHaveLength(1);
  });

  it("drops the user when the API reports the session expired", async () => {
    mockApi();
    show();
    await screen.findByText("Ada Lovelace");

    act(() => { window.dispatchEvent(new Event("session-expired")); });
    await waitFor(() => expect(screen.getByText("Signed out")).toBeInTheDocument());
  });
});
