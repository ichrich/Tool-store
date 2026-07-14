import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adminFetchOrder,
  adminUpdateOrderAdminNote,
  adminUpdateOrderStatus,
} from "../../api/adminApi";
import { formatDate, formatPrice } from "../../utils/format";

const labels = {
  new: "Новый",
  processing: "В обработке",
  completed: "Завершён",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

export function AdminOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("new");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const row = await adminFetchOrder(id);
      setOrder(row);
      setStatus(row.status);
      setAdminNote(row.admin_note || "");
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || "Заказ не найден");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function saveStatus() {
    setSaving(true);
    try {
      await adminUpdateOrderStatus(id, status);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Не удалось обновить");
    } finally {
      setSaving(false);
    }
  }

  async function saveAdminNote() {
    setSaving(true);
    try {
      await adminUpdateOrderAdminNote(id, adminNote);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Не удалось сохранить комментарий");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Загрузка…</p>;
  if (error || !order)
    return <p className="field-error">{error || "Нет данных"}</p>;

  return (
    <div>
      <p>
        <Link to="/admin/orders">← Заявки</Link>
      </p>
      <h1>Заявка #{order.id}</h1>
      <p className="muted">{formatDate(order.created_at)}</p>

      <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1rem" }}>Статус</h2>
        <div className="row">
          <select
            className="select"
            style={{ maxWidth: 240 }}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="new">Новый</option>
            <option value="processing">В обработке</option>
            <option value="completed">Завершён</option>
            <option value="delivered">Доставлен</option>
            <option value="cancelled">Отменён</option>
          </select>
          <button
            type="button"
            className="btn btn--primary"
            onClick={saveStatus}
            disabled={saving}
          >
            {saving ? "Сохранение…" : "Сохранить статус"}
          </button>
        </div>
        <p className="muted">Текущий: {labels[order.status]}</p>
      </div>

      <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1rem" }}>
          Внутренний комментарий администратора
        </h2>
        <textarea
          className="textarea"
          rows={3}
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          placeholder="Этот комментарий виден только администраторам"
        />
        <button
          type="button"
          className="btn btn--primary"
          style={{ marginTop: 12 }}
          onClick={saveAdminNote}
          disabled={saving}
        >
          Сохранить комментарий
        </button>
      </div>

      <div className="card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1rem" }}>Клиент</h2>
        <p style={{ margin: 0 }}>{order.customer_name}</p>
        <p style={{ margin: 0 }}>{order.customer_email}</p>
        <p style={{ margin: 0 }}>{order.customer_phone}</p>
        {order.customer_company && (
          <p style={{ margin: 0 }}>{order.customer_company}</p>
        )}
        {order.address && (
          <p style={{ margin: "0.5rem 0 0", whiteSpace: "pre-wrap" }}>
            {order.address}
          </p>
        )}
        {order.notes && (
          <p style={{ margin: "0.5rem 0 0", whiteSpace: "pre-wrap" }}>
            <strong>Комментарий:</strong> {order.notes}
          </p>
        )}
        {order.admin_note && (
          <p style={{ margin: "0.5rem 0 0", whiteSpace: "pre-wrap" }}>
            <strong>Комментарий администратора:</strong> {order.admin_note}
          </p>
        )}
      </div>

      <h2 style={{ fontSize: "1.1rem" }}>Позиции</h2>
      <div className="table-wrap">
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
            {order.items.map((it) => (
              <tr key={it.id}>
                <td>
                  <div>{it.product_name_snapshot}</div>
                  <div
                    className="admin-action-stack"
                    style={{ minWidth: "auto", marginTop: 8 }}
                  >
                    <Link
                      className="btn btn--sm"
                      to={`/product/${it.product_slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      На сайте
                    </Link>
                    <Link
                      className="btn btn--sm"
                      to={`/admin/products/${it.product_id}`}
                    >
                      В админке
                    </Link>
                  </div>
                </td>
                <td>{formatPrice(it.unit_price)}</td>
                <td>{it.quantity}</td>
                <td>{formatPrice(it.unit_price * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
