import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { CatalogPage } from "../CatalogPage";
import { renderWithProviders } from "../../test/renderWithProviders";

describe("CatalogPage", () => {
  test("renders products loaded from REST API", async () => {
    renderWithProviders(<CatalogPage />, { route: "/catalog" });

    expect(await screen.findByText("Bosch GSR 18V-50")).toBeInTheDocument();
    expect(screen.getByText("Makita DDF485Z")).toBeInTheDocument();
  });

  test("filters products by selected brand model", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CatalogPage />, { route: "/catalog" });

    expect(await screen.findByText("Makita DDF485Z")).toBeInTheDocument();
    await user.click(screen.getByLabelText("GSR 18V-50"));

    await waitFor(() => {
      expect(screen.getByText("Bosch GSR 18V-50")).toBeInTheDocument();
      expect(screen.queryByText("Makita DDF485Z")).not.toBeInTheDocument();
    });
  });
});
