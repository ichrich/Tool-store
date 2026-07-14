const { pool } = require("../config/database");

/** Сумма купленных единиц товара (неотменённые заказы). */
async function getPurchasedUnits(userId, productId) {
  const [[row]] = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity), 0) AS u
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.product_id = ? AND o.user_id = ? AND o.status <> 'cancelled'`,
    [productId, userId],
  );
  return Number(row?.u || 0);
}

async function getUserReviewCount(userId, productId) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS c FROM reviews
     WHERE product_id = ? AND user_id = ? AND status <> 'deleted'`,
    [productId, userId],
  );
  return Number(row?.c || 0);
}

async function canUserAddReview(userId, productId) {
  const purchased = await getPurchasedUnits(userId, productId);
  const written = await getUserReviewCount(userId, productId);
  return purchased > written;
}

module.exports = { getPurchasedUnits, getUserReviewCount, canUserAddReview };
