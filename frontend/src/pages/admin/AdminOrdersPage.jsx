import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminFetchOrders } from "../../api/adminApi";

const labels = {
  new: "Новый",
  processing: "В обработке",
  completed: "Завершён",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

const ORDER_SORT_FIELDS = [
  { key: "id", label: "Номер" },
  { key: "created_at", label: "Дата" },
  { key: "customer_name", label: "Клиент" },
  { key: "customer_email", label: "Email" },
  { key: "status", label: "Статус" },
  { key: "items_count", label: "Позиций" },
];

function SortTh({ field, label, sort, order, onToggle }) {
  const active = sort === field;
  return (
    <th>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        style={{ fontWeight: active ? 700 : 500, padding: "2px 4px" }}
        onClick={() => onToggle(field)}
      >
        {label}
        {active ? (order === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

export function AdminOrdersPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [data, setData] = useState({ orders: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState("desc");
  const [search, setSearch] = useState("");

  const toggleSort = useCallback((field) => {
    setSort((prev) => {
      if (prev === field) {
        setOrder((o) => (o === "asc" ? "desc" : "asc"));
        return prev;
      }
      setOrder("desc");
      return field;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetchOrders({
        status: status || undefined,
        search: search || undefined,
        page: 1,
        limit: 50,
        sort,
        order,
      });
      setData(res);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [status, sort, order, search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1>Заявки</h1>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ maxWidth: 280 }}>
          <label htmlFor="st">Статус</label>
          <select
            className="select"
            id="st"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Все</option>
            <option value="new">Новый</option>
            <option value="processing">В обработке</option>
            <option value="completed">Завершён</option>
            <option value="delivered">Доставлен</option>
            <option value="cancelled">Отменён</option>
          </select>
        </div>
        <div className="field" style={{ maxWidth: 340 }}>
          <label>Поиск</label>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Номер, клиент, email, телефон"
          />
        </div>
      </div>
      {loading && <p>Загрузка…</p>}
      {error && <p className="field-error">{error}</p>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {ORDER_SORT_FIELDS.map(({ key, label }) => (
                <SortTh
                  key={key}
                  field={key}
                  label={label}
                  sort={sort}
                  order={order}
                  onToggle={toggleSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {data.orders.map((o) => (
              <tr
                key={o.id}
                className="admin-clickable-row"
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/admin/orders/${o.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") navigate(`/admin/orders/${o.id}`);
                }}
              >
                <td>{o.id}</td>
                <td>{new Date(o.created_at).toLocaleString("ru-RU")}</td>
                <td>{o.customer_name}</td>
                <td>{o.customer_email}</td>
                <td>
                  <span className={`badge badge--${o.status}`}>
                    {labels[o.status] || o.status}
                  </span>
                </td>
                <td>{o.items_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Всего: {data.total}</p>
    </div>
  );
}
