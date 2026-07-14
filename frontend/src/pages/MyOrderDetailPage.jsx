import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  cancelMyOrder,
  createPayment,
  fetchMyOrderDetail,
  requestMyOrderCancel,
} from "../api/publicApi";
import { useToast } from "../context/ToastContext";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ConfirmModal } from "../components/ConfirmModal";
import { formatDate, formatPrice } from "../utils/format";

const STATUS_LABELS = {
  new: "Новый",
  processing: "В обработке",
  completed: "Выполнен",
  delivered: "Доставлен",
  cancelled: "Отменен",
};

const PAYMENT_LABELS = {
  cash: "Наличными при получении",
  yookassa: "ЮKassa",
};

const PAYMENT_STATUS_LABELS = {
  paid: "Оплачен",
  failed: "Ошибка оплаты",
  pending: "Ожидает оплаты",
};

const CANCEL_REASONS = [
  { value: "changed_mind", label: "Передумал оформлять заказ" },
  { value: "wrong_contacts", label: "Неверно указаны контактные данные" },
  { value: "wrong_address", label: "Неверно указан адрес" },
  { value: "duplicate", label: "Заказ был оформлен повторно" },
  { value: "too_long", label: "Долгое ожидание обработки" },
  { value: "other", label: "Другая причина" },
];

export function MyOrderDetailPage() {
  const { id } = useParams();
  const { success, error: showError } = useToast();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelRequestOpen, setCancelRequestOpen] = useState(false);
  const [cancelRequest, setCancelRequest] = useState({
    reason: "changed_mind",
    comment: "",
  });
  const [paymentBusy, setPaymentBusy] = useState(false);

  async function reload() {
    const data = await fetchMyOrderDetail(id);
    setOrder(data);
  }

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((err) => showError(err.userMessage || "Ошибка загрузки заказа"))
      .finally(() => setLoading(false));
  }, [id]);

  async function cancelOrder() {
    setCancelBusy(true);
    try {
      await cancelMyOrder(id);
      success("Заказ отменен");
      await reload();
    } catch (e) {
      showError(e.userMessage || "Не удалось отменить заказ");
    } finally {
      setCancelBusy(false);
    }
  }

  async function requestCancel() {
    setCancelBusy(true);
    try {
      await requestMyOrderCancel(id, cancelRequest);
      success("Заявка на отмену отправлена администратору");
      setCancelRequestOpen(false);
    } catch (e) {
      showError(e.userMessage || "Не удалось отправить заявку");
    } finally {
      setCancelBusy(false);
    }
  }

  async function payOrder() {
    setPaymentBusy(true);
    try {
      const payment = await createPayment(id);
      localStorage.setItem("lastOrderId", String(id));
      localStorage.setItem("lastPaymentId", payment.paymentId);
      window.location.href = payment.confirmationUrl;
    } catch (e) {
      showError(e.userMessage || "Не удалось перейти к оплате");
      setPaymentBusy(false);
    }
  }

  if (loading)
    return (
      <div className="page-loading">
        <div className="spinner spinner--lg" />
      </div>
    );
  if (!order)
    return (
      <div className="container">
        <div className="alert alert--error">Заказ не найден</div>
      </div>
    );

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: "Главная", to: "/" },
          { label: "Мои заказы", to: "/my-orders" },
          { label: `Заказ #${order.id}` },
        ]}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          marginBottom: "var(--space-5)",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0 }}>Заказ #{order.id}</h1>
        <span className={`badge badge--${order.status}`}>
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      <div className="two-col-responsive" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="card__body">
            <h3>Информация о заказе</h3>
            <dl className="detail-list">
              <dt className="muted">Дата:</dt>
              <dd>{formatDate(order.created_at)}</dd>
              <dt className="muted">Способ оплаты:</dt>
              <dd>
                {PAYMENT_LABELS[order.payment_method] || order.payment_method}
              </dd>
              <dt className="muted">Статус оплаты:</dt>
              <dd>
                {order.payment_method === "cash" &&
                order.payment_status === "pending"
                  ? "Не оплачено"
                  : PAYMENT_STATUS_LABELS[order.payment_status] ||
                    order.payment_status}
              </dd>
              {order.delivery_time && (
                <>
                  <dt className="muted">Время доставки:</dt>
                  <dd>{formatDate(order.delivery_time)}</dd>
                </>
              )}
              {order.address && (
                <>
                  <dt className="muted">Адрес:</dt>
                  <dd>{order.address}</dd>
                </>
              )}
              {order.notes && (
                <>
                  <dt className="muted">Примечание:</dt>
                  <dd>{order.notes}</dd>
                </>
              )}
            </dl>
            {order.payment_method === "yookassa" &&
              order.payment_status !== "paid" &&
              order.status !== "cancelled" && (
                <div
                  className="alert alert--warning"
                  style={{ marginBottom: "var(--space-4)" }}
                >
                  Заказ ожидает оплату ЮKassa. После оплаты администратор сможет
                  завершить заказ.
                  <div style={{ marginTop: "var(--space-3)" }}>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={paymentBusy}
                      onClick={payOrder}
                    >
                      {paymentBusy ? "Переход к оплате..." : "Оплатить"}
                    </button>
                  </div>
                </div>
              )}
            {order.status === "new" && (
              <button
                type="button"
                className="btn btn--danger"
                disabled={cancelBusy}
                onClick={() => setConfirmCancel(true)}
              >
                Отменить заказ
              </button>
            )}
            {order.status === "processing" && (
              <button
                type="button"
                className="btn btn--secondary"
                disabled={cancelBusy}
                onClick={() => setCancelRequestOpen(true)}
              >
                Оставить заявку на отмену
              </button>
            )}
            {["completed", "delivered"].includes(order.status) && (
              <div
                className="alert alert--info"
                style={{ marginTop: "var(--space-4)" }}
              >
                Заказ выполнен. Вы можете оставить отзывы на полученные товары.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__body">
            <h3>Контактные данные</h3>
            <dl className="detail-list">
              <dt className="muted">Имя:</dt>
              <dd>{order.customer_name}</dd>
              <dt className="muted">Email:</dt>
              <dd>{order.customer_email}</dd>
              <dt className="muted">Телефон:</dt>
              <dd>{order.customer_phone}</dd>
              {order.customer_company && (
                <>
                  <dt className="muted">Компания:</dt>
                  <dd>{order.customer_company}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--space-5)" }}>
        <div className="card__body">
          <h3>Состав заказа</h3>
          <div
            className="table-wrap"
            style={{ border: "none", borderRadius: 0 }}
          >
            <table className="data-table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Цена</th>
                  <th>Кол-во</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.product_slug ? (
                        <Link to={`/product/${item.product_slug}`}>
                          {item.product_name_snapshot}
                        </Link>
                      ) : (
                        <span>
                          {item.product_name_snapshot}{" "}
                          <span className="muted">(удален)</span>
                        </span>
                      )}
                    </td>
                    <td className="muted">{formatPrice(item.unit_price)}</td>
                    <td>{item.quantity} шт.</td>
                    <td>
                      <strong>
                        {formatPrice(item.unit_price * item.quantity)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: "var(--space-4)", textAlign: "right" }}>
            {order.discount_amount > 0 && (
              <div className="muted" style={{ marginBottom: "var(--space-2)" }}>
                Скидка: -{formatPrice(order.discount_amount)}
                {order.promo_code && ` (${order.promo_code})`}
              </div>
            )}
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
              Итого:{" "}
              <span className="price">{formatPrice(order.total_amount)}</span>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmCancel}
        title="Отменить заказ?"
        message="Заказ будет отменён, а товары вернутся на склад. Продолжить?"
        confirmText="Да, отменить"
        cancelText="Нет"
        onConfirm={async () => {
          setConfirmCancel(false);
          await cancelOrder();
        }}
        onCancel={() => setConfirmCancel(false)}
      />

      {cancelRequestOpen && (
        <div
          className="modal-overlay"
          onClick={() => setCancelRequestOpen(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">Заявка на отмену заказа</h3>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setCancelRequestOpen(false)}
              >
                x
              </button>
            </div>
            <div className="modal__body">
              <div className="field">
                <label>Причина</label>
                <select
                  className="select"
                  value={cancelRequest.reason}
                  onChange={(e) =>
                    setCancelRequest((v) => ({ ...v, reason: e.target.value }))
                  }
                >
                  {CANCEL_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Комментарий</label>
                <textarea
                  className="textarea"
                  rows={4}
                  value={cancelRequest.comment}
                  onChange={(e) =>
                    setCancelRequest((v) => ({ ...v, comment: e.target.value }))
                  }
                  placeholder="Можно указать детали: неверный телефон, адрес или другую информацию для администратора"
                />
              </div>
            </div>
            <div className="modal__footer">
              <button
                type="button"
                className="btn"
                onClick={() => setCancelRequestOpen(false)}
              >
                Закрыть
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={cancelBusy}
                onClick={requestCancel}
              >
                {cancelBusy ? "Отправка…" : "Отправить заявку"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
