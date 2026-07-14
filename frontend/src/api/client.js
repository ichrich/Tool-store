export const TOKEN_KEY = "telega_token";
export const USER_KEY = "telega_user";
export const AUTH_CLEARED_EVENT = "telega-auth-cleared";
export const BLOCKED_ACCOUNT_KEY = "telega_blocked_account_notice";

const SESSION_KEY = "telega_session_id";
const REQUEST_TIMEOUT = 15000;

function normalizeApiBase(raw) {
  const fallback =
    import.meta.env.MODE === "test"
      ? "http://localhost:3001/api"
      : typeof window === "undefined"
        ? "/api"
        : `${window.location.origin}/api`;

  if (!raw || typeof raw !== "string") return fallback;
  const normalized = raw.trim().replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

function getSessionId() {
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
  }
}

function isAuthEndpoint(url = "") {
  return url.includes("/auth/login") || url.includes("/auth/register");
}

function buildUrl(baseUrl, endpoint, params) {
  if (/^https?:\/\//i.test(endpoint)) {
    throw new Error("Абсолютные URL запрещены для API-клиента");
  }

  const suffix = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = new URL(`${baseUrl}${suffix}`);
  for (const [key, rawValue] of Object.entries(params || {})) {
    if (rawValue === undefined || rawValue === null || rawValue === "")
      continue;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    values.forEach((value) => url.searchParams.append(key, String(value)));
  }
  return url;
}

function mapError(error, endpoint) {
  if (!error.response) {
    error.userMessage =
      "Нет соединения с сервером. Проверьте подключение к интернету.";
    return error;
  }

  const status = error.response.status;
  const serverMessage = error.response.data?.error;

  if (status === 401) {
    if (!isAuthEndpoint(endpoint)) clearStoredAuth();
    error.userMessage = isAuthEndpoint(endpoint)
      ? serverMessage || "Неверный email или пароль"
      : "Сессия истекла. Войдите снова.";
  } else if (status === 403) {
    error.userMessage =
      serverMessage || "Недостаточно прав для выполнения действия";
    if (error.response.data?.code === "ACCOUNT_BLOCKED") {
      localStorage.setItem(
        BLOCKED_ACCOUNT_KEY,
        JSON.stringify({
          message: error.userMessage,
          appeal_token: error.response.data?.appeal_token || null,
          appeal_status: error.response.data?.appeal_status || null,
          appeal_rejection_reason:
            error.response.data?.appeal_rejection_reason || null,
          blocked_at: new Date().toISOString(),
        }),
      );
      clearStoredAuth();
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/admin") &&
        !isAuthEndpoint(endpoint)
      ) {
        window.location.assign("/login?blocked=1");
      }
    }
  } else if (status === 404) {
    error.userMessage = serverMessage || "Ресурс не найден";
  } else if (status === 409) {
    error.userMessage = serverMessage || "Конфликт данных";
  } else if (status === 400 || status === 422) {
    error.userMessage = serverMessage || "Ошибка валидации данных";
  } else if (status >= 500) {
    error.userMessage = serverMessage || "Ошибка сервера. Попробуйте позже.";
  } else {
    error.userMessage = serverMessage || "Произошла ошибка";
  }

  return error;
}

async function request(method, endpoint, data, config = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const headers = {
      Accept: "application/json",
      "x-session-id": getSessionId(),
      ...(config.headers || {}),
    };
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;

    const isFormData =
      typeof FormData !== "undefined" && data instanceof FormData;
    if (data !== undefined && !isFormData) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(
      buildUrl(client.baseURL, endpoint, config.params),
      {
        method,
        headers,
        body:
          data === undefined
            ? undefined
            : isFormData
              ? data
              : JSON.stringify(data),
        signal: controller.signal,
        credentials: "same-origin",
      },
    );

    const responseData =
      config.responseType === "blob"
        ? await response.blob()
        : response.status === 204
          ? null
          : await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(responseData?.error || `HTTP ${response.status}`);
      error.config = { url: endpoint };
      error.response = { status: response.status, data: responseData };
      throw error;
    }

    return {
      data: responseData,
      status: response.status,
      headers: response.headers,
    };
  } catch (error) {
    throw mapError(error, endpoint);
  } finally {
    clearTimeout(timeout);
  }
}

export const client = {
  baseURL: normalizeApiBase(import.meta.env.VITE_API_URL),
  get: (url, config) => request("GET", url, undefined, config),
  post: (url, data, config) => request("POST", url, data, config),
  put: (url, data, config) => request("PUT", url, data, config),
  patch: (url, data, config) => request("PATCH", url, data, config),
  delete: (url, config) => request("DELETE", url, undefined, config),
};

export default client;
