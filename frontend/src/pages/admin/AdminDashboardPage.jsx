import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import {
  adminGetOrdersReport,
  adminGetProductsReport,
  adminGetUsersReport,
} from "../../api/adminApi";
import { formatPrice } from "../../utils/format";

const MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

export function AdminDashboardPage() {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      adminGetOrdersReport({}),
      adminGetProductsReport(),
      adminGetUsersReport(),
    ])
      .then(
        ([orders, products, users]) =>
          active && setReports({ orders, products, users }),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const salesData = useMemo(() => {
    const buckets = Array.from({ length: 6 }, (_, offset) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - offset));
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        name: MONTHS[date.getMonth()],
        revenue: 0,
        orders: 0,
      };
    });
    (reports?.orders?.rows || []).forEach((order) => {
      const date = new Date(order.created_at);
      const bucket = buckets.find(
        (item) => item.key === `${date.getFullYear()}-${date.getMonth()}`,
      );
      if (bucket) {
        bucket.revenue += Number(order.total_amount) || 0;
        bucket.orders += 1;
      }
    });
    return buckets;
  }, [reports]);

  const topProducts = useMemo(
    () =>
      (reports?.products?.rows || [])
        .slice()
        .sort((a, b) => Number(b.total_sold) - Number(a.total_sold))
        .slice(0, 6)
        .map((item) => ({
          name:
            item.name.length > 18 ? `${item.name.slice(0, 18)}…` : item.name,
          sold: Number(item.total_sold) || 0,
        })),
    [reports],
  );

  if (loading)
    return (
      <div className="admin-dashboard-loading">
        <span className="spinner spinner--lg" />
        Загружаем показатели
      </div>
    );

  const revenue = Number(reports?.orders?.sum) || 0;
  const orderCount = Number(reports?.orders?.total) || 0;
  const products = reports?.products?.rows || [];
  const users = reports?.users?.rows || [];

  return (
    <div className="admin-dashboard">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Рабочее пространство</span>
          <h1>Обзор магазина</h1>
          <p>Продажи, каталог и аудитория в одном месте.</p>
        </div>
        <Link className="btn btn--primary" to="/admin/reports">
          Открыть отчёты <ArrowUpRight size={17} />
        </Link>
      </div>

      <div className="metric-grid">
        <article className="metric-card metric-card--accent">
          <CircleDollarSign />
          <span>Выручка</span>
          <strong>{formatPrice(revenue)}</strong>
          <small>за весь период</small>
        </article>
        <article className="metric-card">
          <ShoppingCart />
          <span>Заказы</span>
          <strong>{orderCount}</strong>
          <small>всего оформлено</small>
        </article>
        <article className="metric-card">
          <Boxes />
          <span>Товары</span>
          <strong>{products.length}</strong>
          <small>
            {products.filter((p) => Number(p.stock) <= 5).length} требуют
            внимания
          </small>
        </article>
        <article className="metric-card">
          <UsersRound />
          <span>Пользователи</span>
          <strong>{users.length}</strong>
          <small>{users.filter((u) => u.is_active).length} активных</small>
        </article>
      </div>

      <div className="dashboard-grid">
        <section
          className="dashboard-panel dashboard-panel--wide notranslate"
          translate="no"
        >
          <div className="panel-heading">
            <div>
              <span>Динамика</span>
              <h2>Продажи за 6 месяцев</h2>
            </div>
            <span className="panel-badge">Выручка</span>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={salesData}
                margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff5a36" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#ff5a36" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="var(--color-text-muted)"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                  formatter={(value) => formatPrice(value)}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#ff5a36"
                  strokeWidth={3}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="dashboard-panel notranslate" translate="no">
          <div className="panel-heading">
            <div>
              <span>Ассортимент</span>
              <h2>Лидеры продаж</h2>
            </div>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 16, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--color-border)"
                  horizontal={false}
                />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={118}
                  stroke="var(--color-text-muted)"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-muted)" }}
                  contentStyle={{
                    background: "var(--color-surface-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                  formatter={(value) => [`${value} шт.`, "Продано"]}
                />
                <Bar
                  name="Продано"
                  dataKey="sold"
                  fill="#54b7c5"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
