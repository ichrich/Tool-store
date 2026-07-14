const { pool } = require("../config/database");

async function createOrderWithItems(orderRow, items) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const productIds = [...new Set(items.map((it) => Number(it.product_id)))];
    const [lockedProducts] = productIds.length
      ? await conn.query(
          `SELECT id, name, stock, is_deleted FROM products WHERE id IN (${productIds.map(() => "?").join(",")}) FOR UPDATE`,
          productIds,
        )
      : [[]];
    const byId = new Map(
      lockedProducts.map((product) => [Number(product.id), product]),
    );
    for (const item of items) {
      const product = byId.get(Number(item.product_id));
      if (!product || product.is_deleted) {
        const err = new Error("Товар больше не доступен");
        err.status = 400;
        throw err;
      }
      if (Number(item.quantity) < 1 || Number(item.quantity) > 999) {
        const err = new Error("Количество товара должно быть от 1 до 999");
        err.status = 400;
        throw err;
      }
      if (Number(product.stock) < Number(item.quantity)) {
        const err = new Error(
          `Недостаточно товара "${product.name}". Доступно: ${product.stock}`,
        );
        err.status = 400;
        err.details = { product_id: item.product_id, available: product.stock };
        throw err;
      }
    }

    const subtotal = items.reduce(
      (s, it) => s + Number(it.unit_price) * Number(it.quantity),
      0,
    );
    const discount = Math.max(
      0,
      Math.min(subtotal, Number(orderRow.discount_amount || 0)),
    );
    const total_amount = Math.max(
      0,
      Math.round((subtotal - discount) * 100) / 100,
    );

    const [orderRes] = await conn.query(
      `INSERT INTO orders
        (user_id, status, customer_name, customer_email, customer_phone, customer_company,
         address, notes, payment_method, payment_status, delivery_time, total_amount, discount_amount, promo_code)
       VALUES (?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderRow.user_id ?? null,
        orderRow.customer_name,
        orderRow.customer_email,
        orderRow.customer_phone,
        orderRow.customer_company ?? null,
        orderRow.address ?? null,
        orderRow.notes ?? null,
        orderRow.payment_method ?? "cash",
        orderRow.payment_status ?? "pending",
        orderRow.delivery_time ?? null,
        total_amount,
        discount,
        orderRow.promo_code ?? null,
      ],
    );
    const orderId = orderRes.insertId;

    for (const it of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, product_name_snapshot)
         VALUES (?, ?, ?, ?, ?)`,
        [
          orderId,
          it.product_id,
          it.quantity,
          it.unit_price,
          it.product_name_snapshot,
        ],
      );
      await conn.query("UPDATE products SET stock = stock - ? WHERE id = ?", [
        it.quantity,
        it.product_id,
      ]);
    }

    await conn.commit();
    return orderId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listAdmin({
  status,
  search = "",
  page = 1,
  limit = 20,
  sort = "created_at",
  order = "desc",
} = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const lim = Number(limit);
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push("o.status = ?");
    params.push(status);
  }
  if (search) {
    conditions.push(
      "(o.customer_name LIKE ? OR o.customer_email LIKE ? OR o.customer_phone LIKE ? OR o.id = ?)",
    );
    const like = `%${search}%`;
    const exactId = Number(search) || 0;
    params.push(like, like, like, exactId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const ALLOWED_SORT = [
    "id",
    "created_at",
    "customer_name",
    "customer_email",
    "status",
    "total_amount",
    "items_count",
  ];
  const sortField = ALLOWED_SORT.includes(sort) ? sort : "created_at";
  const sortOrder = String(order).toLowerCase() === "asc" ? "ASC" : "DESC";

  const [rows] = await pool.query(
    `SELECT o.*,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items_count
     FROM orders o ${where}
     ORDER BY ${sortField === "items_count" ? "(SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id)" : `o.${sortField}`} ${sortOrder}
     LIMIT ? OFFSET ?`,
    [...params, lim, offset],
  );
  const [[{ c }]] = await pool.query(
    `SELECT COUNT(*) AS c FROM orders o ${where}`,
    params,
  );
  return { orders: rows, total: c };
}

async function getByIdWithItems(id) {
  const [[order]] = await pool.query("SELECT * FROM orders WHERE id = ?", [id]);
  if (!order) return null;
  const [items] = await pool.query(
    `SELECT oi.*, p.slug AS product_slug
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [id],
  );
  return { ...order, items };
}

async function listByUser(userId, { page = 1, limit = 20 } = {}) {
  const offset = (Number(page) - 1) * Number(limit);
  const lim = Number(limit);
  const [rows] = await pool.query(
    `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, lim, offset],
  );
  const [[{ c }]] = await pool.query(
    "SELECT COUNT(*) AS c FROM orders WHERE user_id = ?",
    [userId],
  );
  return { orders: rows, total: c };
}

async function updateStatus(id, status) {
  await pool.query("UPDATE orders SET status = ? WHERE id = ?", [status, id]);
}

async function updateAdminNote(id, adminNote) {
  await pool.query("UPDATE orders SET admin_note = ? WHERE id = ?", [
    adminNote || null,
    id,
  ]);
}

async function updateEditableFields(id, fields = {}) {
  const allowed = [
    "customer_name",
    "customer_email",
    "customer_phone",
    "customer_company",
    "address",
    "delivery_time",
    "notes",
    "admin_note",
  ];
  const entries = allowed.filter((key) =>
    Object.prototype.hasOwnProperty.call(fields, key),
  );
  if (entries.length === 0) return;
  const sets = entries.map((key) => `${key} = ?`).join(", ");
  const values = entries.map((key) => fields[key] || null);
  await pool.query(`UPDATE orders SET ${sets} WHERE id = ?`, [...values, id]);
}

async function updatePaymentStatus(id, payment_status) {
  await pool.query("UPDATE orders SET payment_status = ? WHERE id = ?", [
    payment_status,
    id,
  ]);
}

async function failPaymentAndCancel(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query(
      `SELECT id, status, payment_status
       FROM orders
       WHERE id = ?
       FOR UPDATE`,
      [id],
    );
    if (!order || order.payment_status === "paid") {
      await conn.rollback();
      return false;
    }
    const [items] = await conn.query(
      "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
      [id],
    );
    for (const item of items) {
      if (item.product_id) {
        await conn.query("UPDATE products SET stock = stock + ? WHERE id = ?", [
          item.quantity,
          item.product_id,
        ]);
      }
    }
    await conn.query(
      "UPDATE orders SET status = IF(status = 'new', 'cancelled', status), payment_status = 'failed' WHERE id = ?",
      [id],
    );
    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function cancelByAdmin(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query(
      `SELECT id, status, payment_method, payment_status
       FROM orders
       WHERE id = ?
       FOR UPDATE`,
      [id],
    );
    if (!order) {
      await conn.rollback();
      return false;
    }
    if (order.status !== "cancelled") {
      const [items] = await conn.query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
        [id],
      );
      for (const item of items) {
        if (item.product_id) {
          await conn.query(
            "UPDATE products SET stock = stock + ? WHERE id = ?",
            [item.quantity, item.product_id],
          );
        }
      }
    }
    await conn.query(
      `UPDATE orders
       SET status = 'cancelled',
           payment_status = IF(payment_method = 'cash' AND payment_status = 'pending', 'pending', payment_status)
       WHERE id = ?`,
      [id],
    );
    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function cancelByUser(id, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query(
      `SELECT id, status, payment_status
       FROM orders
       WHERE id = ? AND user_id = ?
       FOR UPDATE`,
      [id, userId],
    );
    if (!order) {
      await conn.rollback();
      return { ok: false, code: "not_found" };
    }
    if (order.status !== "new") {
      await conn.rollback();
      return { ok: false, code: "not_cancellable" };
    }
    if (order.payment_status === "paid") {
      await conn.rollback();
      return { ok: false, code: "paid_requires_admin" };
    }
    const [items] = await conn.query(
      "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
      [id],
    );
    for (const item of items) {
      if (item.product_id) {
        await conn.query("UPDATE products SET stock = stock + ? WHERE id = ?", [
          item.quantity,
          item.product_id,
        ]);
      }
    }
    await conn.query(
      "UPDATE orders SET status = 'cancelled', payment_status = IF(payment_method = 'cash' AND payment_status = 'pending', 'pending', IF(payment_status = 'pending', 'failed', payment_status)) WHERE id = ?",
      [id],
    );
    await conn.commit();
    return { ok: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function createCancelRequest({ orderId, userId, reason, comment }) {
  const marker = "[ORDER_CANCEL_REQUEST]";
  const [pending] = await pool.query(
    "SELECT id, message FROM unblock_appeals WHERE user_id = ? AND status = 'pending' AND message LIKE ?",
    [userId, `${marker}%`],
  );
  const existing = pending.find((row) => {
    try {
      const payload = JSON.parse(
        String(row.message || "").slice(marker.length),
      );
      return Number(payload.order_id) === Number(orderId);
    } catch {
      return false;
    }
  });
  if (existing) return { id: existing.id, existed: true };
  const [res] = await pool.query(
    `INSERT INTO unblock_appeals (user_id, message)
     VALUES (?, ?)`,
    [
      userId,
      `${marker}${JSON.stringify({
        order_id: Number(orderId),
        reason: reason || "other",
        comment: comment || "",
      })}`,
    ],
  );
  return { id: res.insertId, existed: false };
}

module.exports = {
  createOrderWithItems,
  listAdmin,
  getByIdWithItems,
  listByUser,
  updateStatus,
  updateAdminNote,
  updateEditableFields,
  updatePaymentStatus,
  failPaymentAndCancel,
  cancelByAdmin,
  cancelByUser,
  createCancelRequest,
};
