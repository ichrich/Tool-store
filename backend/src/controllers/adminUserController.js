const { pool } = require("../config/database");
const userModel = require("../models/userModel");
const notificationModel = require("../models/notificationModel");

async function list(req, res, next) {
  try {
    const {
      page = 1,
      limit = 25,
      search = "",
      sort = "created_at",
      order = "desc",
    } = req.query;
    const result = await userModel.listAll({
      page,
      limit,
      search,
      sort,
      order,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
}

async function block(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (id === Number(req.user.sub)) {
      return res
        .status(400)
        .json({ error: "Нельзя заблокировать собственный аккаунт" });
    }
    const [[target]] = await pool.query(
      "SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1",
      [id],
    );
    if (!target)
      return res.status(404).json({ error: "Пользователь не найден" });
    if (target.role === "admin" && target.is_active) {
      const [[{ c }]] = await pool.query(
        "SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1",
      );
      if (Number(c) <= 1) {
        return res.status(400).json({
          error: "Нельзя заблокировать последнего активного администратора",
        });
      }
    }
    await userModel.update(id, { is_active: 0 });
    await notificationModel.create({
      user_id: id,
      type: "account_blocked",
      title: "Аккаунт заблокирован",
      body: "Вы можете подать апелляцию в личном кабинете.",
      entity_type: "user",
      entity_id: id,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function unblock(req, res, next) {
  try {
    await userModel.update(Number(req.params.id), { is_active: 1 });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function suspendReviews(req, res, next) {
  try {
    const { reason, expires_at } = req.body;
    const userId = Number(req.params.id);
    await pool.query(
      "INSERT INTO user_suspensions (user_id, admin_id, reason, expires_at) VALUES (?, ?, ?, ?)",
      [userId, Number(req.user.sub), reason, expires_at || null],
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function detail(req, res, next) {
  try {
    const id = Number(req.params.id);
    const [[user]] = await pool.query(
      `SELECT id, email, role, first_name, last_name, phone, is_active, vk_user_id, created_at
       FROM users WHERE id = ?`,
      [id],
    );
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });

    const [orders] = await pool.query(
      `SELECT id, status, total_amount, payment_status, created_at, customer_name
       FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 25`,
      [id],
    );
    for (const o of orders) {
      const [its] = await pool.query(
        `SELECT id, product_id, quantity, unit_price, product_name_snapshot
         FROM order_items WHERE order_id = ?`,
        [o.id],
      );
      o.items = its;
    }

    const [reviews] = await pool.query(
      `SELECT r.id, r.product_id, r.rating, r.body, r.status, r.created_at,
              p.name AS product_name, p.slug AS product_slug
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC LIMIT 40`,
      [id],
    );

    const [suspensions] = await pool.query(
      `SELECT s.id, s.reason, s.expires_at, s.created_at, s.admin_id,
              a.email AS admin_email
       FROM user_suspensions s
       LEFT JOIN users a ON a.id = s.admin_id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`,
      [id],
    );

    const [reportsOnTheirReviews] = await pool.query(
      `SELECT rr.id, rr.status, rr.reason, rr.created_at, rr.review_id, rr.reviewer_sanction
       FROM review_reports rr
       INNER JOIN reviews r ON r.id = rr.review_id AND r.user_id = ?
       ORDER BY rr.created_at DESC LIMIT 30`,
      [id],
    );

    res.json({
      user,
      orders,
      reviews,
      suspensions,
      reports_on_reviews: reportsOnTheirReviews,
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, block, unblock, suspendReviews, detail };
