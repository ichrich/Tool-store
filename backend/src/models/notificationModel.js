const { pool } = require("../config/database");

async function create({
  user_id = null,
  type,
  title,
  body = null,
  entity_type = null,
  entity_id = null,
}) {
  const [res] = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, entity_type, entity_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user_id, type, title, body, entity_type, entity_id],
  );
  return res.insertId;
}

async function createForAdmins(data) {
  const [admins] = await pool.query(
    "SELECT id FROM users WHERE role = 'admin'",
  );
  await Promise.all(
    admins.map((admin) => create({ ...data, user_id: admin.id })),
  );
}

async function listForUser(userId, { limit = 30 } = {}) {
  const [rows] = await pool.query(
    `SELECT * FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, Number(limit)],
  );
  return rows;
}

async function markRead(userId, id) {
  const [res] = await pool.query(
    "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
    [id, userId],
  );
  return res.affectedRows > 0;
}

module.exports = { create, createForAdmins, listForUser, markRead };
