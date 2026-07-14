const { pool } = require("../config/database");

/**
 * Активные ограничения на отзывы (expires_at NULL = бессрочно).
 */
async function listActiveForUser(userId) {
  const [rows] = await pool.query(
    `SELECT id, reason, expires_at, created_at, admin_id
     FROM user_suspensions
     WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

/** Сводка для UI: есть ли блок, бессрочно ли, крайний срок снятия временных */
async function getReviewRestrictionSummary(userId) {
  const rows = await listActiveForUser(userId);
  if (!rows.length) {
    return { active: false, permanent: false, expires_at: null, reasons: [] };
  }
  const permanent = rows.some((r) => !r.expires_at);
  const finite = rows
    .filter((r) => r.expires_at)
    .map((r) => new Date(r.expires_at).getTime());
  const expires_at = permanent
    ? null
    : finite.length
      ? new Date(Math.max(...finite))
      : null;
  return {
    active: true,
    permanent,
    expires_at,
    reasons: [...new Set(rows.map((r) => r.reason).filter(Boolean))],
  };
}

module.exports = { listActiveForUser, getReviewRestrictionSummary };
