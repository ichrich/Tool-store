import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { FormField } from "../components/FormField";

function validate(values) {
  const errors = {};
  if (!values.email) errors.email = "Email обязателен";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
    errors.email = "Некорректный email";
  if (!values.password) errors.password = "Пароль обязателен";
  else if (values.password.length < 6) errors.password = "Минимум 6 символов";
  else if (!/[A-Za-z]/.test(values.password))
    errors.password = "Пароль должен содержать хотя бы одну букву";
  if (values.password !== values.password_confirm)
    errors.password_confirm = "Пароли не совпадают";
  if (values.phone && !/^[\d\+\-\(\)\s]{6,20}$/.test(values.phone)) {
    errors.phone = "Некорректный формат телефона (от 6 символов)";
  }
  return errors;
}

export function RegisterPage() {
  const { register } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [values, setValues] = useState({
    email: "",
    password: "",
    password_confirm: "",
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [errors, setErrors] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

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
    const errs = validate(values);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const { password_confirm, ...data } = values;
      const res = await register(data);
      if (res.user?.review_restriction?.active) {
        sessionStorage.setItem(
          "review_restriction_modal",
          JSON.stringify(res.user.review_restriction),
        );
      }
      success("Регистрация прошла успешно! Добро пожаловать!");
      navigate("/");
    } catch (err) {
      const serverFields = err.response?.data?.fields;
      if (serverFields) setFieldErrors(serverFields);
      showError(err.userMessage || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <Breadcrumbs
        items={[{ label: "Главная", to: "/" }, { label: "Регистрация" }]}
      />

      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="card">
          <div className="card__body" style={{ padding: "var(--space-6)" }}>
            <h1 style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
              <span style={{ color: "var(--color-accent)" }}></span> Регистрация
            </h1>

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
                label="Email *"
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
              <FormField
                name="password"
                label="Пароль *"
                type="password"
                placeholder="Минимум 6 символов"
                autoComplete="new-password"
                value={values.password}
                onChange={(v) => set("password", v)}
                error={errors.password || fieldErrors.password}
              />
              <FormField
                name="password_confirm"
                label="Подтвердите пароль *"
                type="password"
                placeholder="Повторите пароль"
                autoComplete="new-password"
                value={values.password_confirm}
                onChange={(v) => set("password_confirm", v)}
                error={errors.password_confirm || fieldErrors.password_confirm}
              />

              <div
                className="field-hint"
                style={{
                  marginBottom: "var(--space-4)",
                  fontSize: "0.8rem",
                  color: "var(--color-text-muted)",
                }}
              >
                * — обязательные поля
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--full btn--lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> Регистрация...
                  </>
                ) : (
                  "Зарегистрироваться"
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
              Уже есть аккаунт? <Link to="/login">Войти</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
