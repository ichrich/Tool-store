import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchMyOrders } from "../api/publicApi";
import { useToast } from "../context/ToastContext";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { Pagination } from "../components/Pagination";
import { formatDate, formatPrice } from "../utils/format";

const STATUS_LABELS = {
  new: "Новый",
  processing: "В обработке",
  completed: "Выполнен",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

const PAYMENT_LABELS = {
  cash: "Наличными при получении",
  yookassa: "ЮKassa",
};

export function MyOrdersPage() {
  const { error: showError } = useToast();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchMyOrders({ page, limit })
      .then((data) => {
        setOrders(data.orders);
        setTotal(data.total);
      })
      .catch((err) => showError(err.userMessage || "Ошибка загрузки заказов"))
      .finally(() => setLoading(false));
  }, [page, limit]);

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: "Главная", to: "/" },
          { label: "Профиль", to: "/profile" },
          { label: "Мои заказы" },
        ]}
      />
      <h1 style={{ marginBottom: "var(--space-5)" }}>Мои заказы</h1>

      {loading ? (
        <div className="page-loading">
          <div className="spinner spinner--lg" />
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon"></div>
          <div className="empty-state__title">У вас пока нет заказов</div>
          <Link
            to="/catalog"
            className="btn btn--primary"
            style={{ marginTop: "var(--space-4)" }}
          >
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th>Оплата</th>
                  <th>Сумма</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>#{o.id}</strong>
                    </td>
                    <td className="muted">{formatDate(o.created_at)}</td>
                    <td>
                      <span className={`badge badge--${o.status}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="muted">
                      {PAYMENT_LABELS[o.payment_method] || o.payment_method}
                    </td>
                    <td>
                      <strong className="price">
                        {formatPrice(o.total_amount)}
                      </strong>
                    </td>
                    <td>
                      <Link
                        to={`/my-orders/${o.id}`}
                        className="btn btn--sm btn--secondary"
                      >
                        Подробнее
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </>
      )}
    </div>
  );
}
