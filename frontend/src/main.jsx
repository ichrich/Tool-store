import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { App } from "./App";
import "./styles/global.css";

function AppWithCart() {
  const { isAuthenticated } = useAuth();
  return (
    <CartProvider isAuthenticated={isAuthenticated}>
      <App />
    </CartProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter
    future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
  >
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppWithCart />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </BrowserRouter>,
);
