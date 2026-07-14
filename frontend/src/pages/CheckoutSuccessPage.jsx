import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { checkPaymentStatus } from "../api/publicApi";

const PAYMENT_LABELS = {
  cash: "Наличными при получении",
  yookassa: "ЮKassa",
};

export function CheckoutSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const id =
    location.state?.orderId ||
    query.get("orderId") ||
    localStorage.getItem("lastOrderId");
  const paymentMethod =
    location.state?.paymentMethod || query.get("paymentMethod");
  const paymentLabel = PAYMENT_LABELS[paymentMethod] || paymentMethod;

  useEffect(() => {
    const paymentId = localStorage.getItem("lastPaymentId");
    const paymentToken = localStorage.getItem("lastPaymentToken");
    const orderId = id || localStorage.getItem("lastOrderId");
    if (paymentId && orderId) {
      checkPaymentStatus(paymentId, orderId, paymentToken).catch(() => {});
    }
  }, [id]);

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: "Главная", to: "/" },
          { label: "Корзина", to: "/cart" },
          { label: "Заказ оформлен" },
        ]}
      />
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div
          className="card__body"
          style={{ textAlign: "center", padding: "var(--space-8)" }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "var(--space-4)" }}>
            Заказ оформлен
          </div>
          <h1 style={{ marginBottom: "var(--space-3)" }}>Заказ принят!</h1>
          {id && (
            <p className="muted">
              Номер заказа:{" "}
              <strong className="text-accent" style={{ fontSize: "1.25rem" }}>
                #{id}
              </strong>
            </p>
          )}
          {paymentMethod && (
            <p className="muted">
              Способ оплаты: <strong>{paymentLabel}</strong>
            </p>
          )}
          <p
            style={{
              marginTop: "var(--space-4)",
              color: "var(--color-text-secondary)",
            }}
          >
            Менеджер может связаться с вами по почту для уточнения деталей.
          </p>

          <div style={{ marginTop: "var(--space-6)" }} className="stack">
            <Link className="btn btn--primary btn--full" to="/catalog">
              Продолжить покупки
            </Link>
            {id && (
              <button
                type="button"
                className="btn btn--secondary btn--full"
                onClick={() => navigate(`/my-orders/${id}`)}
              >
                К заказу
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
