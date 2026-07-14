import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  updateProfileApi,
  getMeApi,
  getVkLinkCodeApi,
  unlinkVkApi,
} from "../api/authApi";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { FormField } from "../components/FormField";
import { Link } from "react-router-dom";
import { useReviewRestrictionCountdown } from "../components/ReviewRestrictionModal";
import { createAppeal } from "../api/publicApi";
import { useTheme } from "../context/ThemeContext";
import { Moon, Sun } from "lucide-react";

function validate(values, baselineUser) {
  const errors = {};
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Некорректный email";
  }
  if (values.phone && !/^[\d\+\-\(\)\s]{6,20}$/.test(values.phone)) {
    errors.phone = "Некорректный формат телефона (от 6 символов)";
  }
  const emailChanging =
    String(values.email || "").trim() !==
    String(baselineUser?.email || "").trim();
  const phoneChanging =
    String(values.phone || "").trim() !==
    String(baselineUser?.phone || "").trim();
  if (
    (emailChanging || phoneChanging) &&
    !String(values.current_password || "").trim()
  ) {
    errors.current_password =
      "Укажите текущий пароль для смены email или телефона";
  }
  if (values.password) {
    if (values.password.length < 6) errors.password = "Минимум 6 символов";
    if (!values.current_password) {
      errors.current_password =
        errors.current_password || "Введите текущий пароль";
    }
    if (values.password !== values.password_confirm)
      errors.password_confirm = "Пароли не совпадают";
  }
  return errors;
}

function valuesFromUser(user) {
  return {
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    current_password: "",
    password: "",
    password_confirm: "",
  };
}

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { success, error: showError } = useToast();
  const { theme, setTheme } = useTheme();

  const [values, setValues] = useState(() => valuesFromUser(user));
  const [errors, setErrors] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [vkLink, setVkLink] = useState(null);
  const [vkLinkError, setVkLinkError] = useState(null);
  const [vkLoading, setVkLoading] = useState(false);
  const [vkRefreshLoading, setVkRefreshLoading] = useState(false);
  const [sanctionAppealMessage, setSanctionAppealMessage] = useState("");
  const [sanctionAppealLoading, setSanctionAppealLoading] = useState(false);

  const rr = user?.review_restriction;
  const restrictionLeft = useReviewRestrictionCountdown(
    rr?.active && !rr?.permanent ? rr?.expires_at : null,
  );

  useEffect(() => {
    if (user) {
      setValues((prev) => ({
        ...valuesFromUser(user),
        current_password: prev.current_password,
        password: prev.password,
        password_confirm: prev.password_confirm,
      }));
    }
  }, [
    user?.id,
    user?.email,
    user?.first_name,
    user?.last_name,
    user?.phone,
    user?.review_restriction,
  ]);

  useEffect(() => {
    getMeApi()
      .then((me) => updateUser(me))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- один раз при открытии профиля
  }, []);

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

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate(values, user);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const emailChanging =
        String(values.email || "").trim() !== String(user?.email || "").trim();
      const phoneChanging =
        String(values.phone || "").trim() !== String(user?.phone || "").trim();
      const payload = {
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone,
        email: values.email,
      };
      if (values.password) {
        payload.password = values.password;
      }
      if (emailChanging || phoneChanging || values.password) {
        payload.current_password = values.current_password;
      }
      if (!payload.password) delete payload.password;

      const updated = await updateProfileApi(payload);
      updateUser(updated);
      setValues((v) => ({
        ...v,
        current_password: "",
        password: "",
        password_confirm: "",
      }));
      success("Профиль успешно обновлён");
    } catch (err) {
      const serverFields = err.response?.data?.fields;
      if (serverFields) setFieldErrors(serverFields);
      showError(err.userMessage || "Ошибка обновления профиля");
    } finally {
      setLoading(false);
    }
  }

  async function requestVkLink() {
    setVkLoading(true);
    setVkLink(null);
    setVkLinkError(null);
    try {
      const d = await getVkLinkCodeApi();
      const link = d?.link || null;
      const code = d?.code || null;

      if (!d?.success || !link) {
        const msg =
          d?.error ||
          "Ссылка VK не получена. Проверьте VK_GROUP_ID в backend/.env.";
        setVkLinkError(msg);
        if (code) setVkLink({ success: false, code, link: null });
        showError(msg);
        return;
      }

      setVkLink({ success: true, code, link });
      window.open(link, "_blank", "noopener,noreferrer");
      success("Ссылка для привязки VK готова");
    } catch (e) {
      const msg = e.userMessage || "Не удалось создать ссылку";
      setVkLinkError(msg);
      showError(msg);
    } finally {
      setVkLoading(false);
    }
  }

  async function refreshVkStatus() {
    setVkRefreshLoading(true);
    try {
      const me = await getMeApi();
      updateUser(me);
      if (me.vk_user_id) {
        success("VK привязан");
        setVkLink(null);
        setVkLinkError(null);
      } else {
        showError(
          "VK ещё не привязан. Откройте ссылку в VK и напишите боту, затем нажмите снова.",
        );
      }
    } catch (e) {
      showError(e.userMessage || "Не удалось обновить статус");
    } finally {
      setVkRefreshLoading(false);
    }
  }

  async function unlinkVk() {
    try {
      const updated = await unlinkVkApi();
      updateUser(updated);
      success("VK отвязан");
    } catch (e) {
      showError(e.userMessage || "Не удалось отвязать VK");
    }
  }

  async function submitSanctionAppeal(e) {
    e.preventDefault();
    if (!sanctionAppealMessage.trim()) {
      showError("Опишите, почему ограничение нужно пересмотреть.");
      return;
    }
    setSanctionAppealLoading(true);
    try {
      const fd = new FormData();
      fd.append("message", sanctionAppealMessage.trim());
      await createAppeal(fd);
      setSanctionAppealMessage("");
      success("Апелляция отправлена. Решение придёт уведомлением.");
    } catch (err) {
      showError(err.userMessage || "Не удалось отправить апелляцию");
    } finally {
      setSanctionAppealLoading(false);
    }
  }

  return (
    <div className="container">
      <Breadcrumbs
        items={[{ label: "Главная", to: "/" }, { label: "Профиль" }]}
      />

      <div className="profile-layout">
        <div className="card">
          <div className="card__body">
            <div style={{ textAlign: "center", padding: "var(--space-4) 0" }}>
              <div style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>
                Профиль
              </div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                {user?.first_name
                  ? `${user.first_name} ${user.last_name || ""}`
                  : user?.email}
              </div>
              <div className="muted">{user?.email}</div>
              <span
                className={`badge badge--${user?.role}`}
                style={{ marginTop: "var(--space-2)" }}
              >
                {user?.role === "admin" ? "Администратор" : "Пользователь"}
              </span>
            </div>
            {rr?.active && (
              <div
                className="alert alert--warning"
                style={{ marginTop: "var(--space-3)", textAlign: "left" }}
              >
                <strong>Ограничение на отзывы.</strong>
                {rr.reasons?.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    Причина: {rr.reasons.join("; ")}
                  </div>
                )}
                {rr.permanent ? (
                  <div className="muted" style={{ marginTop: 6 }}>
                    Срок: бессрочно.
                  </div>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    Осталось до снятия: {restrictionLeft}
                  </div>
                )}
              </div>
            )}
            {rr?.active && (
              <form
                onSubmit={submitSanctionAppeal}
                style={{ marginTop: "var(--space-3)" }}
              >
                <div className="field">
                  <label htmlFor="sanction-appeal">Апелляция по санкции</label>
                  <textarea
                    id="sanction-appeal"
                    className="textarea"
                    value={sanctionAppealMessage}
                    onChange={(e) => setSanctionAppealMessage(e.target.value)}
                    placeholder="Опишите, почему ограничение нужно пересмотреть"
                    maxLength={5000}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn--secondary btn--full"
                  disabled={sanctionAppealLoading}
                >
                  {sanctionAppealLoading ? "Отправка..." : "Подать апелляцию"}
                </button>
              </form>
            )}
            <hr
              style={{
                borderColor: "var(--color-border)",
                margin: "var(--space-4) 0",
              }}
            />
            <nav
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
              }}
            >
              <Link
                to="/my-orders"
                className="btn btn--ghost"
                style={{ justifyContent: "flex-start" }}
              >
                Мои заказы
              </Link>
            </nav>
            <div className="theme-setting">
              <div>
                <strong>Тема интерфейса</strong>
                <span>Выбор сохранится на этом устройстве</span>
              </div>
              <div
                className="theme-segment"
                role="group"
                aria-label="Тема интерфейса"
              >
                <button
                  type="button"
                  className={theme === "dark" ? "active" : ""}
                  onClick={() => setTheme("dark")}
                  aria-pressed={theme === "dark"}
                >
                  <Moon size={16} />
                  Тёмная
                </button>
                <button
                  type="button"
                  className={theme === "light" ? "active" : ""}
                  onClick={() => setTheme("light")}
                  aria-pressed={theme === "light"}
                >
                  <Sun size={16} />
                  Светлая
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__body">
            <h2 style={{ marginBottom: "var(--space-5)" }}>
              Редактировать профиль
            </h2>

            <form onSubmit={handleSubmit} noValidate>
              <div className="profile-two-col">
                <FormField
                  name="first_name"
                  label="Имя"
                  placeholder="Иван"
                  autoComplete="given-name"
                  value={values.first_name}
                  onChange={(v) => set("first_name", v)}
                  error={errors.first_name || fieldErrors.first_name}
                />
                <FormField
                  name="last_name"
                  label="Фамилия"
                  placeholder="Иванов"
                  autoComplete="family-name"
                  value={values.last_name}
                  onChange={(v) => set("last_name", v)}
                  error={errors.last_name || fieldErrors.last_name}
                />
              </div>
              <FormField
                name="email"
                label="Email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={values.email}
                onChange={(v) => set("email", v)}
                error={errors.email || fieldErrors.email}
              />

              <FormField
                name="phone"
                label="Телефон"
                placeholder="+7 (999) 000-00-00"
                autoComplete="tel"
                value={values.phone}
                onChange={(v) => set("phone", v)}
                error={errors.phone || fieldErrors.phone}
              />

              <hr
                style={{
                  borderColor: "var(--color-border)",
                  margin: "var(--space-5) 0",
                  opacity: 0.5,
                }}
              />
              <h3
                style={{
                  marginBottom: "var(--space-4)",
                  fontSize: "1rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                Пароль
              </h3>

              <FormField
                name="current_password"
                label="Текущий пароль"
                type="password"
                placeholder="Для смены email, телефона или пароля"
                autoComplete="current-password"
                value={values.current_password}
                onChange={(v) => set("current_password", v)}
                error={errors.current_password || fieldErrors.current_password}
              />
              <FormField
                name="password"
                label="Новый пароль"
                type="password"
                placeholder="Оставьте пустым, если не меняете"
                autoComplete="new-password"
                value={values.password}
                onChange={(v) => set("password", v)}
                error={errors.password || fieldErrors.password}
              />
              <FormField
                name="password_confirm"
                label="Подтвердите новый пароль"
                type="password"
                placeholder="Повторите пароль"
                autoComplete="new-password"
                value={values.password_confirm}
                onChange={(v) => set("password_confirm", v)}
                error={errors.password_confirm || fieldErrors.password_confirm}
              />

              <button
                type="submit"
                className="btn btn--primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> Сохранение...
                  </>
                ) : (
                  "Сохранить изменения"
                )}
              </button>
            </form>

            <hr
              style={{
                borderColor: "var(--color-border)",
                margin: "var(--space-6) 0",
              }}
            />
            <h3 style={{ marginBottom: "var(--space-3)", fontSize: "1rem" }}>
              VK Бот
            </h3>
            <p
              className="muted"
              style={{ fontSize: "0.85rem", marginBottom: "var(--space-3)" }}
            >
              Уведомления о заказах и команды в личных сообщениях VK. Для
              админов: /admin_reports.
            </p>

            {user?.vk_user_id ? (
              <div
                className="alert alert--success"
                style={{ marginBottom: "var(--space-3)" }}
              >
                <strong>VK привязан</strong>
                <div
                  className="muted"
                  style={{ marginTop: 6, fontSize: "0.85rem" }}
                >
                  VK user id: {user.vk_user_id}
                </div>
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  style={{ marginTop: "var(--space-3)" }}
                  onClick={unlinkVk}
                >
                  Отвязать VK
                </button>
              </div>
            ) : (
              <>
                <div
                  className="row"
                  style={{ flexWrap: "wrap", gap: "var(--space-2)" }}
                >
                  <button
                    type="button"
                    className="btn btn--secondary"
                    disabled={vkLoading}
                    onClick={requestVkLink}
                  >
                    {vkLoading
                      ? "Генерация..."
                      : "Получить ссылку для привязки"}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={vkRefreshLoading}
                    onClick={refreshVkStatus}
                  >
                    {vkRefreshLoading ? "Проверка..." : "Проверить привязку"}
                  </button>
                </div>

                {vkLinkError && (
                  <p
                    className="field-error"
                    style={{ marginTop: "var(--space-3)" }}
                  >
                    {vkLinkError}
                  </p>
                )}

                {vkLink?.link && (
                  <div
                    className="card"
                    style={{
                      marginTop: "var(--space-3)",
                      padding: "var(--space-3)",
                      background: "var(--color-surface-muted)",
                    }}
                  >
                    <p
                      style={{ margin: "0 0 var(--space-2)", fontWeight: 600 }}
                    >
                      Ссылка для привязки
                    </p>
                    <a
                      href={vkLink.link}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn--primary"
                    >
                      Открыть бота VK
                    </a>
                    <p
                      className="muted"
                      style={{
                        marginTop: "var(--space-2)",
                        fontSize: "0.8rem",
                      }}
                    >
                      После открытия напишите сообществу «Начать». Если VK не
                      передаст ссылку боту, отправьте код ниже отдельным
                      сообщением.
                    </p>
                    <p
                      className="muted"
                      style={{
                        marginTop: "var(--space-2)",
                        fontSize: "0.8rem",
                        wordBreak: "break-all",
                      }}
                    >
                      {vkLink.link}
                    </p>
                    {vkLink.code && (
                      <p
                        className="muted"
                        style={{
                          marginTop: "var(--space-2)",
                          fontSize: "0.75rem",
                        }}
                      >
                        Код: {vkLink.code} (действует 24 часа)
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
