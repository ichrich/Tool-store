const { pool } = require("../config/database");

function normalizeDiscount(data) {
  const type = data.type === "fixed" ? "fixed" : "percent";
  const value = Number(data.value);
  const minOrderAmount =
    data.min_order_amount === undefined || data.min_order_amount === ""
      ? null
      : Number(data.min_order_amount);
  const maxUses =
    data.max_uses === undefined || data.max_uses === ""
      ? null
      : Number(data.max_uses);
  const scope = ["global", "category", "product", "user"].includes(data.scope)
    ? data.scope
    : "global";
  const scopeId =
    data.scope_id === undefined || data.scope_id === ""
      ? null
      : Number(data.scope_id);

  if (!Number.isFinite(value) || value <= 0) {
    const err = new Error("Скидка должна быть больше 0");
    err.status = 400;
    throw err;
  }
  if (type === "percent" && value > 100) {
    const err = new Error("Процентная скидка не может быть больше 100%");
    err.status = 400;
    throw err;
  }
  if (
    minOrderAmount !== null &&
    (!Number.isFinite(minOrderAmount) || minOrderAmount < 0)
  ) {
    const err = new Error(
      "Минимальная сумма заказа не может быть отрицательной",
    );
    err.status = 400;
    throw err;
  }
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
    const err = new Error(
      "Максимум использований должен быть положительным целым числом",
    );
    err.status = 400;
    throw err;
  }
  if (
    ["category", "user"].includes(scope) &&
    (!Number.isInteger(scopeId) || scopeId < 1)
  ) {
    const err = new Error("Выберите область действия промокода");
    err.status = 400;
    throw err;
  }
  if (
    scope === "product" &&
    !(
      Array.isArray(data.product_ids) &&
      data.product_ids.some(
        (id) => Number.isInteger(Number(id)) && Number(id) > 0,
      )
    )
  ) {
    const err = new Error("Выберите хотя бы один товар");
    err.status = 400;
    throw err;
  }

  return {
    code: String(data.code || "")
      .trim()
      .toUpperCase(),
    type,
    value,
    scope,
    scope_id: scope === "global" ? null : scopeId,
    min_order_amount: minOrderAmount,
    max_uses: maxUses,
    starts_at: data.starts_at || null,
    expires_at: data.expires_at || null,
    is_active:
      data.is_active === false ||
      data.is_active === "false" ||
      data.is_active === 0
        ? 0
        : 1,
  };
}

async function findValidCode(code, cartTotal, userId = null, cartItems = []) {
  const now = new Date();
  const [rows] = await pool.query(
    `SELECT * FROM discount_codes
     WHERE code = ?
       AND is_active = 1
       AND (starts_at IS NULL OR starts_at <= ?)
       AND (expires_at IS NULL OR expires_at >= ?)
       AND (max_uses IS NULL OR uses_count < max_uses)
       AND (min_order_amount IS NULL OR min_order_amount <= ?)
     LIMIT 1`,
    [code, now, now, cartTotal],
  );
  if (!rows[0]) return null;
  const disc = rows[0];

  // Проверяем, распространяется ли скидка на этот товар.
  if (disc.scope === "user" && disc.scope_id) {
    if (!userId || disc.scope_id !== userId) return null;
  }
  let applicableTotal = Number(cartTotal);
  if (disc.scope === "category" || disc.scope === "product") {
    const normalizedItems = Array.isArray(cartItems)
      ? cartItems.filter((item) => Number(item.product_id) > 0)
      : [];
    if (!normalizedItems.length) return null;
    const productIds = [
      ...new Set(normalizedItems.map((item) => Number(item.product_id))),
    ];
    const placeholders = productIds.map(() => "?").join(",");
    const [products] = await pool.query(
      `SELECT p.id, p.category_id, p.price,
              EXISTS(SELECT 1 FROM discount_scope_products dsp WHERE dsp.discount_id = ? AND dsp.product_id = p.id) AS selected
       FROM products p WHERE p.id IN (${placeholders})`,
      [disc.id, ...productIds],
    );
    const allowedIds = new Set(
      products
        .filter((product) =>
          disc.scope === "category"
            ? Number(product.category_id) === Number(disc.scope_id)
            : Boolean(product.selected),
        )
        .map((product) => Number(product.id)),
    );
    const prices = new Map(
      products.map((product) => [Number(product.id), Number(product.price)]),
    );
    applicableTotal = normalizedItems.reduce(
      (sum, item) =>
        allowedIds.has(Number(item.product_id))
          ? sum +
            (prices.get(Number(item.product_id)) || 0) *
              (Number(item.quantity) || 0)
          : sum,
      0,
    );
    if (applicableTotal <= 0) return null;
  }
  return { ...disc, applicable_total: applicableTotal };
}

async function incrementUsage(code) {
  await pool.query(
    "UPDATE discount_codes SET uses_count = uses_count + 1 WHERE code = ?",
    [code],
  );
}

async function list() {
  const [rows] = await pool.query(
    `SELECT d.*,
            c.name AS scope_category_name,
            u.email AS scope_user_email,
            GROUP_CONCAT(DISTINCT dsp.product_id ORDER BY dsp.product_id) AS scope_product_ids,
            GROUP_CONCAT(DISTINCT p.name ORDER BY p.name SEPARATOR '|||') AS scope_product_names
     FROM discount_codes d
     LEFT JOIN categories c ON d.scope = 'category' AND c.id = d.scope_id
     LEFT JOIN users u ON d.scope = 'user' AND u.id = d.scope_id
     LEFT JOIN discount_scope_products dsp ON dsp.discount_id = d.id
     LEFT JOIN products p ON p.id = dsp.product_id
     GROUP BY d.id
     ORDER BY d.created_at DESC`,
  );
  return rows.map((row) => ({
    ...row,
    product_ids: row.scope_product_ids
      ? row.scope_product_ids.split(",").map(Number)
      : [],
    product_names: row.scope_product_names
      ? row.scope_product_names.split("|||")
      : [],
  }));
}

async function create(data) {
  const normalized = normalizeDiscount(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.query(
      `INSERT INTO discount_codes
      (code, type, value, scope, scope_id, min_order_amount, max_uses, starts_at, expires_at, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalized.code,
        normalized.type,
        normalized.value,
        normalized.scope,
        normalized.scope_id,
        normalized.min_order_amount,
        normalized.max_uses,
        normalized.starts_at,
        normalized.expires_at,
        normalized.is_active,
      ],
    );
    if (normalized.scope === "product")
      await replaceProducts(conn, res.insertId, data.product_ids);
    await conn.commit();
    return res.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function update(id, data) {
  const normalized = normalizeDiscount(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE discount_codes SET
      code = ?, type = ?, value = ?, scope = ?, scope_id = ?,
      min_order_amount = ?, max_uses = ?, starts_at = ?, expires_at = ?, is_active = ?
     WHERE id = ?`,
      [
        normalized.code,
        normalized.type,
        normalized.value,
        normalized.scope,
        normalized.scope_id,
        normalized.min_order_amount,
        normalized.max_uses,
        normalized.starts_at,
        normalized.expires_at,
        normalized.is_active,
        id,
      ],
    );
    await replaceProducts(
      conn,
      id,
      normalized.scope === "product" ? data.product_ids : [],
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function replaceProducts(conn, discountId, productIds) {
  const ids = [
    ...new Set(
      (Array.isArray(productIds) ? productIds : [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  await conn.query(
    "DELETE FROM discount_scope_products WHERE discount_id = ?",
    [discountId],
  );
  if (!ids.length) return;
  await conn.query(
    "INSERT INTO discount_scope_products (discount_id, product_id) VALUES ?",
    [ids.map((productId) => [discountId, productId])],
  );
}

async function remove(id) {
  await pool.query("DELETE FROM discount_codes WHERE id = ?", [id]);
}

module.exports = {
  findValidCode,
  incrementUsage,
  list,
  create,
  update,
  remove,
};
