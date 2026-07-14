import { useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { createBlockedAppealApi } from "../api/authApi";
import { BLOCKED_ACCOUNT_KEY } from "../api/client";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

function validate(values) {
  const errors = {};
  if (!values.email) errors.email = "Email обязателен";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    errors.email = "Некорректный email";
  if (!values.password) errors.password = "Пароль обязателен";
  return errors;
}

function readBlockedInfo() {
  try {
    const raw = localStorage.getItem(BLOCKED_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(BLOCKED_ACCOUNT_KEY);
    return null;
  }
}

export function LoginPage() {
  const { login } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";
  const [searchParams] = useSearchParams();

  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState(null);
  const [appealMessage, setAppealMessage] = useState("");
  const [appealLoading, setAppealLoading] = useState(false);

  useEffect(() => {
    setBlockedInfo(readBlockedInfo());
  }, [searchParams]);

  function set(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => {
      const n = { ...e };
      delete n[field];
      return n;
    });
    setFieldErrors((e) => {
      const n = { ...e };
      delete n[field];
      return n;
    });
  }

  function persistBlockedInfo(info) {
    setBlockedInfo(info);
    localStorage.setItem(BLOCKED_ACCOUNT_KEY, JSON.stringify(info));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate(values);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const data = await login(values.email, values.password);
      localStorage.removeItem(BLOCKED_ACCOUNT_KEY);
      setBlockedInfo(null);
      if (data.user?.review_restriction?.active) {
        sessionStorage.setItem(
          "review_restriction_modal",
          JSON.stringify(data.user.review_restriction),
        );
      }
      success(`Добро пожаловать, ${data.user.first_name || data.user.email}!`);
      navigate(data.user.role === "admin" ? "/admin" : from, { replace: true });
    } catch (err) {
      const serverFields = err.response?.data?.fields;
      if (serverFields) setFieldErrors(serverFields);
      if (err.response?.data?.code === "ACCOUNT_BLOCKED") {
        persistBlockedInfo({
          message: err.userMessage,
          appeal_token: err.response.data?.appeal_token || null,
          appeal_status: err.response.data?.appeal_status || null,
          appeal_rejection_reason:
            err.response.data?.appeal_rejection_reason || null,
          blocked_at: new Date().toISOString(),
        });
      }
      showError(err.userMessage || "Ошибка входа", { duration: 8000 });
    } finally {
      setLoading(false);
    }
  }

  async function submitAppeal(e) {
    e.preventDefault();
    if (!blockedInfo?.appeal_token) {
      showError(
        "Сначала попробуйте войти в заблокированный аккаунт, чтобы подтвердить личность.",
      );
      return;
    }
    if (!appealMessage.trim()) {
      showError("Опишите, почему блокировку нужно пересмотреть.");
      return;
    }
    setAppealLoading(true);
    try {
      await createBlockedAppealApi({
        appeal_token: blockedInfo.appeal_token,
        message: appealMessage.trim(),
      });
      setAppealMessage("");
      persistBlockedInfo({ ...blockedInfo, appeal_status: "pending" });
      success(
        "Апелляция отправлена. После рассмотрения вы получите уведомление.",
      );
    } catch (err) {
      showError(err.userMessage || "Не удалось отправить апелляцию");
    } finally {
      setAppealLoading(false);
    }
  }

  const blockedMessage =
    blockedInfo?.appeal_rejection_reason ||
    blockedInfo?.message ||
    "Ваш аккаунт заблокирован. Для разблокировки свяжитесь с поддержкой support@telega.ru.";

  return (
    <div className="container">
      <Breadcrumbs items={[{ label: "Главная", to: "/" }, { label: "Вход" }]} />

      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        <div className="card">
          <div className="card__body" style={{ padding: "var(--space-6)" }}>
            <h1 style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
              Вход в аккаунт
            </h1>

            {(blockedInfo || searchParams.get("blocked") === "1") && (
              <div
                className="alert alert--error"
                style={{ marginBottom: "var(--space-4)" }}
              >
                <div>
                  <strong>Аккаунт заблокирован.</strong>
                  <div style={{ marginTop: 6 }}>{blockedMessage}</div>
                  {blockedInfo?.appeal_status === "pending" && (
                    <div className="muted" style={{ marginTop: 8 }}>
                      Апелляция уже отправлена и ожидает рассмотрения.
                    </div>
                  )}
                  {blockedInfo?.appeal_status === "rejected" && (
                    <div className="muted" style={{ marginTop: 8 }}>
                      Последняя апелляция отклонена. Можно отправить новую с
                      дополнительными объяснениями.
                    </div>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className={`input${errors.email || fieldErrors.email ? " input--error" : ""}`}
                  placeholder="you@example.com"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  autoComplete="email"
                />
                {(errors.email || fieldErrors.email) && (
                  <div className="field-error">
                    {errors.email || fieldErrors.email}
                  </div>
                )}
              </div>

              <div className="field">
                <label htmlFor="password">Пароль</label>
                <input
                  id="password"
                  type="password"
                  className={`input${errors.password || fieldErrors.password ? " input--error" : ""}`}
                  placeholder="••••••••"
                  value={values.password}
                  onChange={(e) => set("password", e.target.value)}
                  autoComplete="current-password"
                />
                {(errors.password || fieldErrors.password) && (
                  <div className="field-error">
                    {errors.password || fieldErrors.password}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--full btn--lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> Вход...
                  </>
                ) : (
                  "Войти"
                )}
              </button>
            </form>

            <div
              style={{
                textAlign: "center",
                marginTop: "var(--space-5)",
                color: "var(--color-text-muted)",
                fontSize: "0.875rem",
              }}
            >
              Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
            </div>

            {blockedInfo && blockedInfo.appeal_status !== "pending" && (
              <form
                onSubmit={submitAppeal}
                className="inline-panel"
                style={{ marginTop: "var(--space-5)" }}
              >
                <h2 style={{ fontSize: "1rem" }}>Подать апелляцию</h2>
                <div className="field">
                  <label htmlFor="appeal-message">
                    Сообщение администратору
                  </label>
                  <textarea
                    id="appeal-message"
                    className="textarea"
                    value={appealMessage}
                    onChange={(e) => setAppealMessage(e.target.value)}
                    placeholder="Опишите ситуацию и почему блокировку нужно пересмотреть"
                    maxLength={5000}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn--primary btn--full"
                  disabled={appealLoading}
                >
                  {appealLoading ? "Отправка..." : "Отправить апелляцию"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
