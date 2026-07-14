import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  PackageSearch,
  RefreshCw,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import {
  adminGetOrdersReport,
  adminGetProductsReport,
  adminGetUsersReport,
  downloadReport,
} from "../../api/adminApi";
import { useToast } from "../../context/ToastContext";
import { formatPrice, formatDate } from "../../utils/format";

const TABS = [
  { id: "orders", label: "Заказы", icon: ShoppingCart },
  { id: "products", label: "Товары", icon: PackageSearch },
  { id: "users", label: "Пользователи", icon: UsersRound },
];

const FILE_NAMES = {
  orders: "заказы",
  products: "товары",
  users: "пользователи",
};

export function AdminReportsPage() {
  const { success, error: showError } = useToast();
  const [tab, setTab] = useState("orders");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "orders")
        setData(
          await adminGetOrdersReport({
            from: filters.from || undefined,
            to: filters.to || undefined,
          }),
        );
      else if (tab === "products") setData(await adminGetProductsReport());
      else setData(await adminGetUsersReport());
    } catch (error) {
      showError(error.userMessage || "Не удалось сформировать отчёт");
    } finally {
      setLoading(false);
    }
  }, [tab, filters.from, filters.to, showError]);

  useEffect(() => {
    load();
  }, [tab]);

  async function exportFile(format) {
    try {
      const params =
        tab === "orders"
          ? { from: filters.from || undefined, to: filters.to || undefined }
          : {};
      const blob = await downloadReport(tab, format, params);
      const mime =
        format === "csv"
          ? "text/csv;charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const url = URL.createObjectURL(new Blob([blob], { type: mime }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${FILE_NAMES[tab]}_отчёт.${format === "xlsx" ? "xlsx" : format}`;
      link.click();
      URL.revokeObjectURL(url);
      success("Отчёт скачан");
    } catch (error) {
      showError(error.userMessage || "Не удалось скачать отчёт");
    }
  }

  function includesSearch(row, keys) {
    const query = search.trim().toLowerCase();
    return (
      !query ||
      keys.some((key) =>
        String(row[key] || "")
          .toLowerCase()
          .includes(query),
      )
    );
  }

  const rows = data?.rows || [];
  const chartData = useMemo(() => {
    if (tab === "orders")
      return rows.slice(0, 8).map((row) => ({
        name: `№${row.id}`,
        value: Number(row.total_amount) || 0,
      }));
    if (tab === "products") {
      return rows
        .slice()
        .sort((a, b) => Number(b.total_sold) - Number(a.total_sold))
        .slice(0, 8)
        .map((row, index) => ({
          name: String(row.name || `Товар ${index + 1}`).slice(0, 16),
          value: Number(row.total_sold) || 0,
        }));
    }
    return rows
      .slice()
      .sort((a, b) => Number(b.total_spent) - Number(a.total_spent))
      .slice(0, 8)
      .map((row, index) => ({
        name: String(
          row.first_name || row.email || `Пользователь ${index + 1}`,
        ).split("@")[0],
        value: Number(row.total_spent) || 0,
      }));
  }, [rows, tab]);

  const summary = useMemo(() => {
    if (tab === "orders")
      return [
        { label: "Всего заказов", value: Number(data?.total) || 0 },
        { label: "Общая сумма", value: formatPrice(data?.sum || 0) },
        {
          label: "Средний чек",
          value: formatPrice(
            data?.total ? Number(data.sum) / Number(data.total) : 0,
          ),
        },
      ];
    if (tab === "products")
      return [
        { label: "Товаров в отчёте", value: rows.length },
        {
          label: "Продано единиц",
          value: rows.reduce(
            (sum, row) => sum + (Number(row.total_sold) || 0),
            0,
          ),
        },
        {
          label: "Товаров мало",
          value: rows.filter((row) => Number(row.stock) <= 5).length,
        },
      ];
    return [
      { label: "Пользователей", value: rows.length },
      { label: "Активных", value: rows.filter((row) => row.is_active).length },
      {
        label: "С заказами",
        value: rows.filter((row) => Number(row.orders_count) > 0).length,
      },
    ];
  }, [data, rows, tab]);

  return (
    <div className="reports-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Аналитика магазина</span>
          <h1>Отчёты</h1>
          <p>Сводные данные без лишних таблиц и ручных расчётов.</p>
        </div>
        <div className="reports-export">
          <button
            type="button"
            className="btn"
            onClick={() => exportFile("csv")}
            disabled={!data}
          >
            <Download size={17} />
            Файл CSV
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => exportFile("xlsx")}
            disabled={!data}
          >
            <FileSpreadsheet size={17} />
            Таблица Excel
          </button>
        </div>
      </div>

      <div className="reports-tabs" role="tablist" aria-label="Тип отчёта">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setSearch("");
            }}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      <section className="reports-controls">
        {tab === "orders" && (
          <div className="reports-dates">
            <CalendarDays size={18} />
            <label>
              От
              <input
                type="date"
                className="input"
                value={filters.from}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              До
              <input
                type="date"
                className="input"
                value={filters.to}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        )}
        <label className="reports-search">
          Поиск
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Найти в отчёте"
          />
        </label>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? "spin-icon" : ""} />
          {loading ? "Обновляем" : "Обновить"}
        </button>
      </section>

      {loading && !data ? (
        <div className="admin-dashboard-loading">
          <span className="spinner spinner--lg" />
          Формируем отчёт
        </div>
      ) : (
        <>
          <div className="report-summary-grid">
            {summary.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
          <section className="reports-chart-panel notranslate" translate="no">
            <div className="panel-heading">
              <div>
                <span>Визуальная сводка</span>
                <h2>
                  {tab === "orders"
                    ? "Суммы последних заказов"
                    : tab === "products"
                      ? "Продажи по товарам"
                      : "Покупательская активность"}
                </h2>
              </div>
            </div>
            <div className="reports-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="var(--color-text-muted)"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />
                  <YAxis
                    stroke="var(--color-text-muted)"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 6,
                    }}
                    formatter={(value) => [
                      tab === "products" ? `${value} шт.` : formatPrice(value),
                      tab === "products" ? "Продано" : "Сумма",
                    ]}
                  />
                  <Bar
                    name={tab === "products" ? "Продано" : "Сумма"}
                    dataKey="value"
                    fill="#ff5a36"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <ReportTable tab={tab} rows={rows} includesSearch={includesSearch} />
        </>
      )}
    </div>
  );
}

function ReportTable({ tab, rows, includesSearch }) {
  if (tab === "orders")
    return (
      <div className="table-wrap report-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Заказ</th>
              <th>Статус</th>
              <th>Клиент</th>
              <th>Оплата</th>
              <th>Позиций</th>
              <th>Сумма</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((row) =>
                includesSearch(row, [
                  "id",
                  "customer_name",
                  "customer_email",
                  "status_label",
                ]),
              )
              .map((row) => (
                <tr key={row.id}>
                  <td>№{row.id}</td>
                  <td>
                    <span className={`badge badge--${row.status}`}>
                      {row.status_label || row.status}
                    </span>
                  </td>
                  <td>
                    {row.customer_name}
                    <small>{row.customer_email}</small>
                  </td>
                  <td>{row.payment_method_label || row.payment_method}</td>
                  <td>{row.items_count}</td>
                  <td>
                    <strong>{formatPrice(row.total_amount)}</strong>
                  </td>
                  <td>{formatDate(row.created_at)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  if (tab === "products")
    return (
      <div className="table-wrap report-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Товар</th>
              <th>Категория</th>
              <th>Цена</th>
              <th>Остаток</th>
              <th>Заказов</th>
              <th>Продано</th>
              <th>Выручка</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((row) => includesSearch(row, ["name", "category"]))
              .map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.category}</td>
                  <td>{formatPrice(row.price)}</td>
                  <td>{row.stock}</td>
                  <td>{row.orders_count}</td>
                  <td>{row.total_sold}</td>
                  <td>
                    <strong>{formatPrice(row.total_revenue)}</strong>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <div className="table-wrap report-table">
      <table className="data-table">
        <thead>
          <tr>
            <th>Пользователь</th>
            <th>Имя</th>
            <th>Роль</th>
            <th>Статус</th>
            <th>Заказов</th>
            <th>Потрачено</th>
            <th>Дата регистрации</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((row) =>
              includesSearch(row, ["email", "first_name", "last_name"]),
            )
            .map((row) => (
              <tr key={row.id}>
                <td>{row.email}</td>
                <td>
                  {row.first_name} {row.last_name}
                </td>
                <td>
                  {row.role_label ||
                    (row.role === "admin" ? "Администратор" : "Пользователь")}
                </td>
                <td>
                  {row.active_label ||
                    (row.is_active ? "Активен" : "Заблокирован")}
                </td>
                <td>{row.orders_count}</td>
                <td>
                  <strong>{formatPrice(row.total_spent)}</strong>
                </td>
                <td>{formatDate(row.created_at)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
