import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function AdminLoginPage() {
  const { isAuthenticated, login, logout } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/admin/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.user.role !== "admin") {
        logout();
        setError("Вход в админ-панель разрешён только администраторам");
        return;
      }
    } catch (err) {
      setError(err.response?.data?.error || err.userMessage || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <div className="container" style={{ maxWidth: 420 }}>
          <h1>Вход в админ-панель</h1>
          <p className="muted">
            <Link to="/">На сайт</Link>
          </p>
          {error && <p className="field-error">{error}</p>}
          <form
            onSubmit={onSubmit}
            className="card"
            style={{ padding: "1rem" }}
          >
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Пароль</label>
              <input
                className="input"
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading}
            >
              {loading ? "Вход…" : "Войти"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
