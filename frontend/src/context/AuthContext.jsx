import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AUTH_CLEARED_EVENT, TOKEN_KEY, USER_KEY } from "../api/client";
import { getMeApi, loginApi, registerApi } from "../api/authApi";

const AuthContext = createContext(null);

function readUser() {
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function isTokenFresh(token) {
  if (!token) return false;
  try {
    const [, payload] = token.split(".");
    if (!payload) return false;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const data = JSON.parse(atob(normalized));
    return !data.exp || data.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [initialToken] = useState(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    return isTokenFresh(storedToken) ? storedToken : null;
  });
  const [token, setToken] = useState(initialToken);
  const [user, setUser] = useState(() => (initialToken ? readUser() : null));
  const [isCheckingAuth, setIsCheckingAuth] = useState(Boolean(initialToken));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setIsCheckingAuth(false);
  }, []);

  useEffect(() => {
    if (!initialToken) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setIsCheckingAuth(false);
      return undefined;
    }

    let cancelled = false;
    getMeApi()
      .then((freshUser) => {
        if (cancelled) return;
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
        setUser(freshUser);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setIsCheckingAuth(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialToken, logout]);

  useEffect(() => {
    window.addEventListener(AUTH_CLEARED_EVENT, logout);
    return () => window.removeEventListener(AUTH_CLEARED_EVENT, logout);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const data = await loginApi({ email, password });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setIsCheckingAuth(false);
    return data;
  }, []);

  const register = useCallback(async (formData) => {
    const data = await registerApi(formData);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setIsCheckingAuth(false);
    return data;
  }, []);

  const updateUser = useCallback((updatedUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    setUser(updatedUser);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isCheckingAuth,
      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === "admin",
      login,
      register,
      updateUser,
      logout,
    }),
    [token, user, isCheckingAuth, login, register, updateUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
