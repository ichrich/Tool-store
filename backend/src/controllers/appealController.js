const { pool } = require("../config/database");
const notificationModel = require("../models/notificationModel");

const CANCEL_REASON_LABELS = {
  changed_mind: "Покупатель передумал",
  wrong_contacts: "Неверные контактные данные",
  wrong_address: "Неверный адрес",
  duplicate: "Повторный заказ",
  too_long: "Долгое ожидание обработки",
  other: "Другая причина",
};

const ORDER_CANCEL_MARKER = "[ORDER_CANCEL_REQUEST]";

function parseCancelPayload(message) {
  const raw = String(message || "");
  if (!raw.startsWith(ORDER_CANCEL_MARKER)) return null;
  try {
    const payload = JSON.parse(raw.slice(ORDER_CANCEL_MARKER.length));
    if (!payload?.order_id) return null;
    return {
      order_id: Number(payload.order_id),
      reason: payload.reason || "other",
      comment: payload.comment || "",
    };
  } catch {
    return null;
  }
}

function uploadPath(file) {
  return file ? `/uploads/${file.filename}` : null;
}

async function create(req, res, next) {
  try {
    const userId = Number(req.user.sub);
    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Укажите текст апелляции" });
    }
    const [[pending]] = await pool.query(
      "SELECT id FROM unblock_appeals WHERE user_id = ? AND status = 'pending' LIMIT 1",
      [userId],
    );
    if (pending) {
      return res
        .status(409)
        .json({ error: "У вас уже есть апелляция на рассмотрении" });
    }
    const [ins] = await pool.query(
      `INSERT INTO unblock_appeals (user_id, message, screenshot_path)
       VALUES (?, ?, ?)`,
      [userId, message, uploadPath(req.file)],
    );
    await notificationModel.createForAdmins({
      type: "appeal_created",
      title: `Новая апелляция #${ins.insertId}`,
      body: `Пользователь #${userId} просит разблокировку.`,
      entity_type: "unblock_appeal",
      entity_id: ins.insertId,
    });
    res.status(201).json({ id: ins.insertId });
  } catch (e) {
    next(e);
  }
}

async function myAppeals(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM unblock_appeals
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [Number(req.user.sub)],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function listAdmin(req, res, next) {
  try {
    const status = req.query.status || "pending";
    const params = [];
    const where = status === "all" ? "" : "WHERE ua.status = ?";
    if (status !== "all") params.push(status);
    const [rows] = await pool.query(
      `SELECT ua.*, u.email, u.first_name, u.last_name, u.phone
       FROM unblock_appeals ua
       JOIN users u ON u.id = ua.user_id
       ${where}
       ORDER BY ua.created_at DESC
       LIMIT 100`,
      params,
    );

    const cancelPayloads = new Map();
    rows.forEach((row) => {
      const payload = parseCancelPayload(row.message);
      if (payload) cancelPayloads.set(row.id, payload);
    });
    const orderIds = [
      ...new Set(
        [...cancelPayloads.values()].map((payload) => payload.order_id),
      ),
    ];
    let ordersById = {};
    if (orderIds.length > 0) {
      const [orders] = await pool.query(
        `SELECT id, customer_name, customer_email, customer_phone, address, delivery_time,
                notes, payment_method, payment_status, total_amount, status AS order_status
         FROM orders
         WHERE id IN (${orderIds.map(() => "?").join(",")})`,
        orderIds,
      );
      ordersById = Object.fromEntries(
        orders.map((order) => [Number(order.id), order]),
      );
    }

    const normalized = rows.map((row) => {
      const payload = cancelPayloads.get(row.id);
      if (!payload) {
        return {
          ...row,
          request_key: `unblock:${row.id}`,
          request_type: "unblock",
          request_type_label: "Разблокировка",
          subject: "Заявка на разблокировку",
          message: row.message,
        };
      }
      const order = ordersById[payload.order_id] || {};
      return {
        ...row,
        ...order,
        order_id: payload.order_id,
        reason: payload.reason,
        comment: payload.comment,
        request_key: `cancel:${row.id}`,
        request_type: "cancel_order",
        request_type_label: "Отмена заказа",
        subject: `Отмена заказа #${payload.order_id}`,
        message: [
          `Причина: ${CANCEL_REASON_LABELS[payload.reason] || payload.reason}`,
          payload.comment,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    });

    res.json(
      normalized.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      ),
    );
  } catch (e) {
    next(e);
  }
}

async function resolve(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const rawId = String(req.params.id || "");
    const [kind, idText] = rawId.includes(":")
      ? rawId.split(":")
      : ["unblock", rawId];
    const id = Number(idText);
    const adminId = Number(req.user.sub);
    const status = req.body.status;
    const adminNote = String(req.body.admin_note || "").trim() || null;
    const orderPatch = req.body.order || {};
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Укажите approved или rejected" });
    }
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Некорректный номер заявки" });
    }
    if (kind === "cancel") {
      await conn.beginTransaction();
      const [[request]] = await conn.query(
        "SELECT * FROM unblock_appeals WHERE id = ? AND status = 'pending' FOR UPDATE",
        [id],
      );
      if (!request) {
        await conn.rollback();
        return res
          .status(404)
          .json({ error: "Заявка не найдена или уже обработана" });
      }
      const payload = parseCancelPayload(request.message);
      if (!payload) {
        await conn.rollback();
        return res
          .status(400)
          .json({ error: "Это не заявка на отмену заказа" });
      }
      const [[order]] = await conn.query(
        "SELECT id, user_id, payment_method FROM orders WHERE id = ? FOR UPDATE",
        [payload.order_id],
      );
      if (!order || Number(order.user_id) !== Number(request.user_id)) {
        await conn.rollback();
        return res.status(404).json({ error: "Связанный заказ не найден" });
      }
      if (status === "approved") {
        const fields = {
          customer_name: orderPatch.customer_name,
          customer_email: orderPatch.customer_email,
          customer_phone: orderPatch.customer_phone,
          customer_company: orderPatch.customer_company,
          address: orderPatch.address,
          delivery_time: orderPatch.delivery_time,
          notes: orderPatch.notes,
          admin_note: orderPatch.admin_note || adminNote,
        };
        const allowed = Object.entries(fields).filter(
          ([, value]) => value !== undefined,
        );
        if (allowed.length > 0) {
          await conn.query(
            `UPDATE orders SET ${allowed.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`,
            [...allowed.map(([, value]) => value || null), payload.order_id],
          );
        }
        const [items] = await conn.query(
          "SELECT product_id, quantity FROM order_items WHERE order_id = ?",
          [payload.order_id],
        );
        for (const item of items) {
          if (item.product_id) {
            await conn.query(
              "UPDATE products SET stock = stock + ? WHERE id = ?",
              [item.quantity, item.product_id],
            );
          }
        }
        await conn.query(
          `UPDATE orders
           SET status = 'cancelled',
               payment_status = IF(payment_method = 'cash' AND payment_status = 'pending', 'pending', payment_status)
           WHERE id = ?`,
          [payload.order_id],
        );
      } else if (orderPatch.admin_note || adminNote) {
        await conn.query("UPDATE orders SET admin_note = ? WHERE id = ?", [
          orderPatch.admin_note || adminNote,
          payload.order_id,
        ]);
      }
      await conn.query(
        `UPDATE unblock_appeals
         SET status = ?, admin_id = ?, admin_note = ?, resolved_at = NOW()
         WHERE id = ?`,
        [status, adminId, adminNote, id],
      );
      await conn.commit();

      await notificationModel.create({
        user_id: request.user_id,
        type: "appeal_resolved",
        title:
          status === "approved"
            ? `Заявка на отмену заказа #${payload.order_id} одобрена`
            : `Заявка на отмену заказа #${payload.order_id} отклонена`,
        body:
          adminNote ||
          (status === "approved"
            ? order.payment_method === "cash"
              ? "Заказ отменён. Возврат денег не требуется, так как выбрана оплата наличными."
              : "Заказ отменён. Возврат средств будет обработан администратором."
            : "Администратор рассмотрел заявку и оставил заказ в работе."),
        entity_type: "order",
        entity_id: payload.order_id,
      });
      return res.json({ ok: true });
    }

    await conn.beginTransaction();
    const [[appeal]] = await conn.query(
      "SELECT * FROM unblock_appeals WHERE id = ? AND status = 'pending' FOR UPDATE",
      [id],
    );
    if (!appeal) {
      await conn.rollback();
      return res
        .status(404)
        .json({ error: "Апелляция не найдена или уже обработана" });
    }
    await conn.query(
      `UPDATE unblock_appeals
       SET status = ?, admin_id = ?, admin_note = ?, resolved_at = NOW()
       WHERE id = ?`,
      [status, adminId, adminNote, id],
    );
    if (status === "approved") {
      await conn.query("UPDATE users SET is_active = 1 WHERE id = ?", [
        appeal.user_id,
      ]);
    }
    await conn.commit();
    await notificationModel.create({
      user_id: appeal.user_id,
      type: "appeal_resolved",
      title:
        status === "approved" ? "Апелляция одобрена" : "Апелляция отклонена",
      body:
        adminNote ||
        (status === "approved"
          ? "Администратор снял ограничение. Теперь вы можете снова пользоваться аккаунтом."
          : "Администратор рассмотрел апелляцию и оставил ограничение в силе."),
      entity_type: "unblock_appeal",
      entity_id: id,
    });
    res.json({ ok: true });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* noop */
    }
    next(e);
  } finally {
    conn.release();
  }
}

module.exports = { create, myAppeals, listAdmin, resolve };
