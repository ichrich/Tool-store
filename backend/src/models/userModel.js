const { pool } = require("../config/database");

async function findByEmail(email) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query(
    "SELECT id, email, role, first_name, last_name, phone, is_active, vk_user_id, created_at FROM users WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] || null;
}

async function findByIdWithPassword(id) {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [
    id,
  ]);
  return rows[0] || null;
}

async function emailExists(email, excludeId = null) {
  const sql = excludeId
    ? "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1"
    : "SELECT id FROM users WHERE email = ? LIMIT 1";
  const params = excludeId ? [email, excludeId] : [email];
  const [rows] = await pool.query(sql, params);
  return !!rows[0];
}

async function create(data) {
  const [res] = await pool.query(
    `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.email,
      data.password_hash,
      data.role || "user",
      data.first_name || null,
      data.last_name || null,
      data.phone || null,
    ],
  );
  return res.insertId;
}

async function update(id, data) {
  const fields = [];
  const params = [];

  if (data.first_name !== undefined) {
    fields.push("first_name = ?");
    params.push(data.first_name);
  }
  if (data.last_name !== undefined) {
    fields.push("last_name = ?");
    params.push(data.last_name);
  }
  if (data.phone !== undefined) {
    fields.push("phone = ?");
    params.push(data.phone);
  }
  if (data.email !== undefined) {
    fields.push("email = ?");
    params.push(data.email);
  }
  if (data.password_hash !== undefined) {
    fields.push("password_hash = ?");
    params.push(data.password_hash);
  }
  if (data.vk_user_id !== undefined) {
    fields.push("vk_user_id = ?");
    params.push(data.vk_user_id);
  }
  if (data.is_active !== undefined) {
    fields.push("is_active = ?");
    params.push(data.is_active);
  }

  if (!fields.length) return;
  params.push(id);
  await pool.query(
    `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
    params,
  );
}

async function listAll({
  page = 1,
  limit = 25,
  search = "",
  sort = "created_at",
  order = "desc",
} = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const lim = Number(limit);
  const where = search
    ? "WHERE (u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)"
    : "";
  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

  const sortMap = {
    id: "u.id",
    email: "u.email",
    created_at: "u.created_at",
    role: "u.role",
    is_active: "u.is_active",
    first_name: "u.first_name",
  };
  const sortCol = sortMap[sort] || "u.created_at";
  const sortDir = String(order).toLowerCase() === "asc" ? "ASC" : "DESC";

  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.phone, u.is_active, u.created_at,
            (SELECT COUNT(*) FROM user_suspensions s WHERE s.user_id = u.id) AS sanctions_count,
            (SELECT COUNT(*) FROM review_reports rr
              INNER JOIN reviews r ON r.id = rr.review_id AND r.user_id = u.id
              WHERE rr.status IN ('reviewed','dismissed')
            ) AS reports_processed_count
     FROM users u
     ${where}
     ORDER BY ${sortCol} ${sortDir}
     LIMIT ? OFFSET ?`,
    [...params, lim, offset],
  );
  const [[{ c }]] = await pool.query(
    `SELECT COUNT(*) AS c FROM users u ${where}`,
    params,
  );
  return { items: rows, total: c };
}

module.exports = {
  findByEmail,
  findById,
  findByIdWithPassword,
  emailExists,
  create,
  update,
  listAll,
};
