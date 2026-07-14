import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Boxes,
  FileBarChart,
  FolderTree,
  LogOut,
  MessageSquareWarning,
  Percent,
  ShoppingCart,
  Star,
  Store,
  UsersRound,
} from "lucide-react";
import { AdminResponsiveTables } from "../../components/AdminResponsiveTables";
import { useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Обзор", icon: BarChart3 },
  { to: "/admin/categories", label: "Категории", icon: FolderTree },
  { to: "/admin/products", label: "Товары", icon: Boxes },
  { to: "/admin/orders", label: "Заказы", icon: ShoppingCart },
  { to: "/admin/articles", label: "Статьи", icon: BookOpen },
  { to: "/admin/reviews", label: "Отзывы", icon: Star },
  { to: "/admin/users", label: "Пользователи", icon: UsersRound },
  { to: "/admin/appeals", label: "Заявки", icon: MessageSquareWarning },
  { to: "/admin/discounts", label: "Скидки", icon: Percent },
  { to: "/admin/reports", label: "Отчёты", icon: FileBarChart },
];

export function AdminLayout() {
  const { logout, user } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    success("Выход выполнен");
    navigate("/");
  }

  return (
    <div className="app-shell">
      <header className="site-header admin-header">
        <div className="site-header__inner">
          <Link to="/admin/dashboard" className="site-logo">
            <span className="site-logo__mark">T</span>
            <span>Телега</span>
            <small>УПРАВЛЕНИЕ</small>
          </Link>
          <div className="row">
            <span
              style={{ color: "var(--color-text-muted)", fontSize: "0.875rem" }}
            >
              {user?.email}
            </span>
            <Link to="/" className="btn btn--sm btn--ghost">
              <Store size={16} />
              На сайт
            </Link>
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="app-main">
        <div className="container admin-layout">
          <nav className="admin-sidebar" aria-label="Админ-меню">
            <div className="admin-sidebar__title">Управление</div>
            <div className="admin-nav">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  <item.icon size={18} aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
          <div className="admin-content">
            <AdminResponsiveTables />
            <div className="admin-page-transition" key={location.pathname}>
              <Outlet />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
