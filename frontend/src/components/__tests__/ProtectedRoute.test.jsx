import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { App } from "../../App";
import { TOKEN_KEY, USER_KEY } from "../../api/client";
import { renderWithProviders } from "../../test/renderWithProviders";

function fakeJwt(payload) {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" })).replace(
    /=/g,
    "",
  );
  const body = btoa(JSON.stringify(payload)).replace(/=/g, "");
  return `${header}.${body}.signature`;
}

describe("protected routes", () => {
  test("redirects anonymous user from private page to login", async () => {
    renderWithProviders(<App />, { route: "/my-orders" });

    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
  });

  test("does not allow user role to enter admin area", async () => {
    localStorage.setItem(
      TOKEN_KEY,
      fakeJwt({
        sub: 1,
        email: "buyer@example.com",
        role: "user",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({ id: 1, email: "buyer@example.com", role: "user" }),
    );

    renderWithProviders(<App />, { route: "/admin/products" });

    expect(await screen.findByText("Bosch GSR 18V-50")).toBeInTheDocument();
    expect(screen.queryByText(/Админ/i)).not.toBeInTheDocument();
  });
});
