import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createOrder, validatePromo, createPayment } from "../api/publicApi";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { formatPrice } from "../utils/format";

const initialForm = {
  customer_name: "",
  customer_email: "",
  customer_phone: "",
  customer_company: "",
  address: "",
  notes: "",
  payment_method: "yookassa",
  delivery_time: "",
  promo_code: "",
};

function validateForm(values) {
  const err = {};
  if (!values.customer_name.trim()) err.customer_name = "Укажите имя";
  else if (values.customer_name.length > 200)
    err.customer_name = "Не более 200 символов";
  if (!values.customer_email.trim()) err.customer_email = "Укажите email";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.customer_email))
    err.customer_email = "Некорректный email";
  if (!values.customer_phone.trim()) err.customer_phone = "Укажите телефон";
  else if (!/^[\d+\-\s()]{6,20}$/.test(values.customer_phone))
    err.customer_phone = "Некорректный формат телефона (от 6 символов)";
  if (values.customer_company && values.customer_company.length > 255)
    err.customer_company = "Слишком длинное значение";
  if (values.address && values.address.length > 500)
    err.address = "Не более 500 символов";
  if (values.notes && values.notes.length > 2000)
    err.notes = "Не более 2000 символов";
  if (values.delivery_time && Number.isNaN(Date.parse(values.delivery_time)))
    err.delivery_time = "Укажите дату и время";
  if (
    values.delivery_time &&
    Date.parse(values.delivery_time) < Date.now() - 60000
  )
    err.delivery_time = "Укажите будущую дату доставки";
  if (
    values.promo_code &&
    !/^[A-Za-z0-9_-]{1,50}$/.test(values.promo_code.trim())
  )
    err.promo_code = "Некорректный промокод";
  if (!values.payment_method) err.payment_method = "Выберите способ оплаты";
  return err;
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { items, total, clear, removeItem } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { success, error: toastErr } = useToast();

  const [values, setValues] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [serverFields, setServerFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [promoInfo, setPromoInfo] = useState(null);
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [redirectingPayment, setRedirectingPayment] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      setValues((v) => ({
        ...v,
        customer_email: v.customer_email || user.email || "",
        customer_name:
          v.customer_name ||
          [user.first_name, user.last_name].filter(Boolean).join(" ") ||
          "",
      }));
    }
  }, [isAuthenticated, user]);

  const discountPreview = useMemo(() => {
    if (!promoInfo?.valid) return 0;
    return Number(promoInfo.discount_amount || 0);
  }, [promoInfo]);

  const grandTotal = useMemo(
    () => Math.max(0, total - discountPreview),
    [total, discountPreview],
  );

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((e) => {
      const n = { ...e };
      delete n[name];
      return n;
    });
    setServerFields((e) => {
      const n = { ...e };
      delete n[name];
      return n;
    });
  }

  async function checkPromo() {
    const code = values.promo_code.trim();
    if (!code) {
      toastErr("Введите промокод");
      return;
    }
    setCheckingPromo(true);
    try {
      const r = await validatePromo(
        code,
        total,
        items.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price: item.price,
        })),
      );
      setPromoInfo(r);
      success(r.message || "Промокод применён");
    } catch (e) {
      setPromoInfo(null);
      toastErr(e.userMessage || "Промокод недействителен");
    } finally {
      setCheckingPromo(false);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const v = validateForm(values);
    if (Object.keys(v).length) {
      setErrors(v);
      return;
    }
    if (items.length === 0) {
      toastErr("Корзина пуста");
      return;
    }

    setSubmitting(true);
    setServerFields({});
    try {
      const payload = {
        customer_name: values.customer_name.trim(),
        customer_email: values.customer_email.trim(),
        customer_phone: values.customer_phone.trim(),
        customer_company: values.customer_company.trim() || undefined,
        address: values.address.trim() || undefined,
        notes: values.notes.trim() || undefined,
        payment_method: values.payment_method,
        delivery_time: values.delivery_time
          ? new Date(values.delivery_time).toISOString()
          : undefined,
        promo_code: values.promo_code.trim() || undefined,
        items: items.map((x) => ({
          product_id: x.product_id,
          quantity: x.quantity,
          price: x.price,
        })),
      };

      const res = await createOrder(payload);

      if (values.payment_method === "yookassa") {
        setRedirectingPayment(true);
        const payment = await createPayment(res.id, res.payment_token);

        localStorage.setItem("lastOrderId", res.id);

        localStorage.setItem("lastPaymentId", payment.paymentId);
        localStorage.setItem("lastPaymentToken", res.payment_token);

        await clear();

        window.location.href = payment.confirmationUrl;

        return;
      }

      await clear();
      localStorage.removeItem("lastPaymentId");
      localStorage.removeItem("lastPaymentToken");
      localStorage.setItem("lastOrderId", res.id);

      success("Заказ оформлен");

      navigate("/checkout/success", {
        replace: true,
        state: {
          orderId: res.id,
          paymentMethod: values.payment_method,
        },
      });
    } catch (err) {
      console.log("ERROR RESPONSE:", err.response?.data);
      setRedirectingPayment(false);
      const missingIds = err.response?.data?.missing_product_ids;
      if (
        err.response?.data?.code === "PRODUCT_NOT_FOUND" &&
        Array.isArray(missingIds)
      ) {
        await Promise.all(missingIds.map((id) => removeItem(id)));
        setServerFields({ cart: err.response?.data?.fields?.cart });
        toastErr(
          "Недоступные товары удалены из корзины. Проверьте заказ и повторите оформление.",
        );
        return;
      }
      const fields = err.response?.data?.fields;
      if (fields) setServerFields(fields);
      toastErr(
        err.userMessage ||
          err.response?.data?.error ||
          "Не удалось оформить заказ",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (redirectingPayment) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <div
            className="card__body"
            style={{ textAlign: "center", padding: "var(--space-8)" }}
          >
            <div
              className="spinner spinner--lg"
              style={{ margin: "0 auto var(--space-4)" }}
            />
            <h1>Переходим к оплате</h1>
            <p className="muted">
              Сейчас вы будете перенаправлены на страницу ЮKassa для безопасной
              оплаты заказа.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container">
        <Breadcrumbs
          items={[
            { label: "Главная", to: "/" },
            { label: "Корзина", to: "/cart" },
            { label: "Оформление" },
          ]}
        />
        <h1>Оформление заказа</h1>
        <div className="empty-state">
          <div className="empty-state__icon"></div>
          <div className="empty-state__title">Корзина пуста</div>
          <Link className="btn btn--primary" to="/catalog">
            В каталог
          </Link>
        </div>
      </div>
    );
  }

  const fe = (name) => errors[name] || serverFields[name];

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: "Главная", to: "/" },
          { label: "Корзина", to: "/cart" },
          { label: "Оформление заказа" },
        ]}
      />
      <h1 style={{ marginBottom: "var(--space-5)" }}>Оформление заказа</h1>

      <div className="checkout-layout">
        <form onSubmit={onSubmit} className="card" noValidate>
          <div className="card__body">
            <h3 style={{ marginBottom: "var(--space-4)" }}>
              Контакты и доставка
            </h3>

            <div className="field">
              <label htmlFor="customer_name">Контактное лицо *</label>
              <input
                id="customer_name"
                className={`input${fe("customer_name") ? " input--error" : ""}`}
                value={values.customer_name}
                onChange={(e) => setField("customer_name", e.target.value)}
              />
              {fe("customer_name") && (
                <div className="field-error"> {fe("customer_name")}</div>
              )}
            </div>
            <div className="field">
              <label htmlFor="customer_email">Email *</label>
              <input
                id="customer_email"
                type="email"
                className={`input${fe("customer_email") ? " input--error" : ""}`}
                value={values.customer_email}
                onChange={(e) => setField("customer_email", e.target.value)}
                autoComplete="email"
              />
              {fe("customer_email") && (
                <div className="field-error"> {fe("customer_email")}</div>
              )}
            </div>
            <div className="field">
              <label htmlFor="customer_phone">Телефон *</label>
              <input
                id="customer_phone"
                className={`input${fe("customer_phone") ? " input--error" : ""}`}
                value={values.customer_phone}
                onChange={(e) => setField("customer_phone", e.target.value)}
                autoComplete="tel"
              />
              {fe("customer_phone") && (
                <div className="field-error"> {fe("customer_phone")}</div>
              )}
            </div>
            <div className="field">
              <label htmlFor="customer_company">Компания</label>
              <input
                id="customer_company"
                className="input"
                value={values.customer_company}
                onChange={(e) => setField("customer_company", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="address">Адрес доставки</label>
              <textarea
                id="address"
                className="textarea"
                rows={2}
                value={values.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="delivery_time">Время доставки</label>
              <input
                id="delivery_time"
                type="datetime-local"
                className={`input input--datetime${fe("delivery_time") ? " input--error" : ""}`}
                value={values.delivery_time}
                onChange={(e) => setField("delivery_time", e.target.value)}
              />
              {fe("delivery_time") && (
                <div className="field-error"> {fe("delivery_time")}</div>
              )}
            </div>
            <div className="field">
              <label htmlFor="notes">Комментарий к заказу</label>
              <textarea
                id="notes"
                className="textarea"
                rows={3}
                value={values.notes}
                onChange={(e) => setField("notes", e.target.value)}
              />
            </div>

            <h3 style={{ margin: "var(--space-5) 0 var(--space-3)" }}>
              Оплата
            </h3>

            <div className="field">
              <label>Способ оплаты *</label>

              <div
                className="row"
                style={{
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: "var(--space-2)",
                }}
              >
                <label
                  className="row"
                  style={{
                    cursor: "pointer",
                    gap: "var(--space-2)",
                  }}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="yookassa"
                    checked={values.payment_method === "yookassa"}
                    onChange={(e) => setField("payment_method", e.target.value)}
                  />
                  Оплата картой онлайн (ЮKassa)
                </label>

                <label
                  className="row"
                  style={{
                    cursor: "pointer",
                    gap: "var(--space-2)",
                  }}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="cash"
                    checked={values.payment_method === "cash"}
                    onChange={(e) => setField("payment_method", e.target.value)}
                  />
                  Наличными при получении
                </label>
              </div>

              {fe("payment_method") && (
                <div className="field-error">{fe("payment_method")}</div>
              )}
            </div>

            <h3 style={{ margin: "var(--space-5) 0 var(--space-3)" }}>
              Промокод
            </h3>
            <div
              className="row"
              style={{ gap: "var(--space-2)", flexWrap: "wrap" }}
            >
              <input
                className={`input${fe("promo_code") ? " input--error" : ""}`}
                style={{ flex: 1, minWidth: 160 }}
                placeholder="Промокод"
                value={values.promo_code}
                onChange={(e) => {
                  setField("promo_code", e.target.value);
                  setPromoInfo(null);
                }}
              />
              <button
                type="button"
                className="btn"
                onClick={checkPromo}
                disabled={checkingPromo}
              >
                {checkingPromo ? "..." : "Проверить"}
              </button>
            </div>
            {fe("promo_code") && (
              <div className="field-error"> {fe("promo_code")}</div>
            )}

            <div style={{ marginTop: "var(--space-5)" }}>
              <button
                type="submit"
                className="btn btn--primary btn--lg"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner" /> Отправка...
                  </>
                ) : (
                  "Подтвердить заказ"
                )}
              </button>
            </div>
          </div>
        </form>

        <div
          className="card"
          style={{
            position: "sticky",
            top: "calc(var(--header-height) + var(--space-4))",
          }}
        >
          <div className="card__body">
            <h3 style={{ marginBottom: "var(--space-3)" }}>Ваш заказ</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {items.map((x) => (
                <li
                  key={x.product_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "var(--space-2)",
                    marginBottom: "var(--space-2)",
                    fontSize: "0.9rem",
                  }}
                >
                  <span>
                    {x.name} × {x.quantity}
                  </span>
                  <span className="muted">
                    {formatPrice(x.price * x.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <hr
              style={{
                borderColor: "var(--color-border)",
                margin: "var(--space-4) 0",
              }}
            />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Товары</span>
              <span>{formatPrice(total)}</span>
            </div>
            {discountPreview > 0 && (
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  color: "var(--color-success)",
                }}
              >
                <span>Скидка</span>
                <span>−{formatPrice(discountPreview)}</span>
              </div>
            )}
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                marginTop: "var(--space-3)",
                fontSize: "1.15rem",
                fontWeight: 700,
              }}
            >
              <span>К оплате</span>
              <span className="price">{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
