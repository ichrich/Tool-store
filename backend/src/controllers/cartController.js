const { pool } = require("../config/database");

async function get(req, res, next) {
  try {
    const userId = req.user.sub;
    const [rows] = await pool.query(
      `SELECT ci.id, ci.product_id, ci.quantity,
              p.name, p.slug, p.price, p.image_path, p.stock, p.is_deleted
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?
       ORDER BY ci.created_at`,
      [userId],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function upsert(req, res, next) {
  try {
    const userId = req.user.sub;
    const { product_id, quantity } = req.body;
    const qty = Math.min(Math.max(1, Number(quantity)), 999);

    const [[product]] = await pool.query(
      "SELECT id, stock FROM products WHERE id = ? AND is_deleted = 0 LIMIT 1",
      [product_id],
    );
    if (!product) {
      return res.status(404).json({ error: "Товар не найден" });
    }
    if (product.stock < qty) {
      return res.status(400).json({
        error: `Недостаточно товара на складе. Доступно: ${product.stock}`,
        available: product.stock,
      });
    }

    await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), updated_at = CURRENT_TIMESTAMP`,
      [userId, product_id, qty],
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    const userId = req.user.sub;
    const productId = Number(req.params.productId);
    await pool.query(
      "DELETE FROM cart_items WHERE user_id = ? AND product_id = ?",
      [userId, productId],
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function clear(req, res, next) {
  try {
    const userId = req.user.sub;
    await pool.query("DELETE FROM cart_items WHERE user_id = ?", [userId]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { get, upsert, remove, clear };
