function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";
  const message =
    status >= 500 && isProd
      ? "Внутренняя ошибка сервера"
      : err.message || "Внутренняя ошибка сервера";
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({
    error: message,
    details:
      process.env.NODE_ENV === "development" && err.details
        ? err.details
        : undefined,
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: "Маршрут не найден" });
}

module.exports = { errorHandler, notFoundHandler };
