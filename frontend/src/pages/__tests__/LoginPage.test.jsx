import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { LoginPage } from "../LoginPage";
import { renderWithProviders } from "../../test/renderWithProviders";
import { TOKEN_KEY, USER_KEY } from "../../api/client";

describe("LoginPage", () => {
  test("validates required fields before request", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: "/login" });

    await user.click(screen.getByRole("button"));

    expect(
      document.querySelectorAll(".field-error").length,
    ).toBeGreaterThanOrEqual(2);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test("logs user in and stores JWT data", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: "/login" });

    await user.type(screen.getByLabelText(/email/i), "buyer@example.com");
    await user.type(document.querySelector("#password"), "Secret123");
    await user.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(localStorage.getItem(TOKEN_KEY)).toBe("test.jwt.token"),
    );
    expect(JSON.parse(localStorage.getItem(USER_KEY)).email).toBe(
      "buyer@example.com",
    );
  });

  test("shows API error for wrong credentials", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: "/login" });

    await user.type(screen.getByLabelText(/email/i), "buyer@example.com");
    await user.type(document.querySelector("#password"), "wrong");
    await user.click(screen.getByRole("button"));

    expect(
      await screen.findByText(/Неверный email или пароль/i),
    ).toBeInTheDocument();
  });

  test("handles 403 blocked account response", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: "/login" });

    await user.type(screen.getByLabelText(/email/i), "blocked@example.com");
    await user.type(document.querySelector("#password"), "Secret123");
    await user.click(screen.getByRole("button"));

    expect(
      await screen.findByText(/Аккаунт заблокирован/i),
    ).toBeInTheDocument();
  });
});
