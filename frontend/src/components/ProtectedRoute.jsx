import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({ adminOnly = true }) {
  const { isAuthenticated, isAdmin, isCheckingAuth } = useAuth();
  const location = useLocation();

  if (isCheckingAuth) {
    return (
      <div className="page-loading">
        <span className="spinner spinner--lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={adminOnly ? "/admin/login" : "/login"}
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function RequireAuth() {
  const { isAuthenticated, isCheckingAuth } = useAuth();
  const location = useLocation();
  if (isCheckingAuth) {
    return (
      <div className="page-loading">
        <span className="spinner spinner--lg" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}
