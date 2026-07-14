require("./config/env");

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const publicRoutes = require("./routes/publicRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { uploadDir } = require("./middleware/upload");
const paymentRoutes = require("./routes/paymentRoutes");
const { startVkLongPoll } = require("./utils/vkLongPoll");
const { pool } = require("./config/database");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "0.0.0.0";
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

const corsOrigin = (
  process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(uploadDir));

app.use("/api/vk", require("./routes/vkRoutes"));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "app-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api", publicRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin", adminRoutes);

if (process.env.NODE_ENV === "production" && fs.existsSync(frontendDist)) {
  app.use(
    express.static(frontendDist, {
      maxAge: "1d",
      index: false,
    }),
  );

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/")) {
      return next();
    }
    return res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, HOST, () => {
  console.log(`Приложение запущено на ${HOST}:${PORT}`);
  startVkLongPoll().catch((e) =>
    console.error("VK Long Poll startup error:", e.message),
  );
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection", reason);
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Получен ${signal}, завершаем работу.`);

  server.close(async () => {
    try {
      await pool.end();
    } finally {
      process.exit(0);
    }
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = { app, server };
