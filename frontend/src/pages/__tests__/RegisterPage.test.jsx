import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { RegisterPage } from "../RegisterPage";
import { renderWithProviders } from "../../test/renderWithProviders";
import { TOKEN_KEY } from "../../api/client";

describe("RegisterPage", () => {
  test("validates password confirmation on client", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: "/register" });

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(document.querySelector("#password"), "Secret123");
    await user.type(document.querySelector("#password_confirm"), "Secret124");
    await user.click(screen.getByRole("button"));

    expect(document.querySelectorAll(".field-error").length).toBeGreaterThan(0);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  test("registers user through API", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: "/register" });

    await user.type(screen.getByLabelText(/email/i), "new@example.com");
    await user.type(document.querySelector("#password"), "Secret123");
    await user.type(document.querySelector("#password_confirm"), "Secret123");
    await user.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(localStorage.getItem(TOKEN_KEY)).toBe("registered.jwt.token"),
    );
  });

  test("shows server field error for duplicated email", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />, { route: "/register" });

    await user.type(screen.getByLabelText(/email/i), "exists@example.com");
    await user.type(document.querySelector("#password"), "Secret123");
    await user.type(document.querySelector("#password_confirm"), "Secret123");
    await user.click(screen.getByRole("button"));

    expect(await screen.findAllByText(/Email уже занят/i)).toHaveLength(2);
  });
});
