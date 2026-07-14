const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const { jwtSecret } = require("../config/env");

function verifyToken(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const payload = verifyToken(req);
  if (!payload) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  const sub = Number(payload.sub);
  req.user = { sub, id: sub, email: payload.email, role: payload.role };
  pool
    .query("SELECT is_active FROM users WHERE id = ? LIMIT 1", [sub])
    .then(([rows]) => {
      const u = rows[0];
      if (!u) return res.status(401).json({ error: "Пользователь не найден" });
      if (!u.is_active) {
        return res.status(403).json({
          error:
            process.env.BLOCKED_USER_MESSAGE ||
            "Ваш аккаунт заблокирован. Для разблокировки свяжитесь с поддержкой: support@telega.local",
          code: "ACCOUNT_BLOCKED",
        });
      }
      return next();
    })
    .catch(next);
}

function requireAuthAllowBlocked(req, res, next) {
  const payload = verifyToken(req);
  if (!payload) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  const sub = Number(payload.sub);
  req.user = { sub, id: sub, email: payload.email, role: payload.role };
  pool
    .query("SELECT id FROM users WHERE id = ? LIMIT 1", [sub])
    .then(([rows]) => {
      if (!rows[0])
        return res.status(401).json({ error: "Пользователь не найден" });
      return next();
    })
    .catch(next);
}

function requireAdmin(req, res, next) {
  const payload = verifyToken(req);
  if (!payload) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  if (payload.role !== "admin") {
    return res.status(403).json({ error: "Недостаточно прав" });
  }
  const sub = Number(payload.sub);
  req.user = { sub, id: sub, email: payload.email, role: payload.role };
  pool
    .query("SELECT is_active FROM users WHERE id = ? LIMIT 1", [sub])
    .then(([rows]) => {
      const u = rows[0];
      if (!u || !u.is_active) {
        return res.status(403).json({
          error: "Аккаунт администратора недоступен",
          code: "ACCOUNT_BLOCKED",
        });
      }
      return next();
    })
    .catch(next);
}

function optionalAuth(req, res, next) {
  const payload = verifyToken(req);
  if (!payload) {
    return next();
  }
  const sub = Number(payload.sub);
  pool
    .query("SELECT is_active FROM users WHERE id = ? LIMIT 1", [sub])
    .then(([rows]) => {
      const u = rows[0];
      if (u && u.is_active) {
        req.user = { sub, id: sub, email: payload.email, role: payload.role };
      }
      return next();
    })
    .catch(next);
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireAuthAllowBlocked,
  optionalAuth,
};
