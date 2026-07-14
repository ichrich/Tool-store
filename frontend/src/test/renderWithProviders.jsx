import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import { CartProvider } from "../context/CartContext";

export function renderWithProviders(
  ui,
  { route = "/", isAuthenticated = false } = {},
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <AuthProvider>
          <CartProvider isAuthenticated={isAuthenticated}>{ui}</CartProvider>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}
