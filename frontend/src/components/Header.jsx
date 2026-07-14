import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { LogIn, LogOut, ShoppingBag, UserRound } from "lucide-react";

export function Header() {
  const { itemCount } = useCart();
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    success("Вы вышли из аккаунта");
    navigate("/");
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-logo">
          <span className="site-logo__mark">T</span>
          <span>Телега</span>
        </Link>

        <nav className="site-nav" aria-label="Основная навигация">
          <NavLink
            to="/catalog"
            className={({ isActive }) =>
              `site-nav__link${isActive ? " site-nav__link--active" : ""}`
            }
          >
            Каталог
          </NavLink>
          <NavLink
            to="/blog"
            className={({ isActive }) =>
              `site-nav__link${isActive ? " site-nav__link--active" : ""}`
            }
          >
            Статьи
          </NavLink>
        </nav>

        <div className="header-actions">
          <Link to="/cart" className="cart-btn">
            <ShoppingBag size={17} aria-hidden="true" />
            {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
            <span>Корзина</span>
          </Link>

          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link to="/admin" className="btn btn--sm">
                  Админ панель
                </Link>
              )}
              <Link to="/profile" className="btn btn--sm btn--secondary">
                <UserRound size={16} aria-hidden="true" />
                {user?.first_name || user?.email?.split("@")[0]}
              </Link>
              <button className="btn btn--sm btn--ghost" onClick={handleLogout}>
                <LogOut size={16} aria-hidden="true" />
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn--sm">
                <LogIn size={16} aria-hidden="true" />
                Войти
              </Link>
              <Link to="/register" className="btn btn--sm btn--primary">
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
