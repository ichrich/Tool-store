const crypto = require("crypto");
const fetch = require("node-fetch");
const jwt = require("jsonwebtoken");

const { pool } = require("../config/database");
const orderModel = require("../models/orderModel");
const notificationModel = require("../models/notificationModel");
const { jwtSecret } = require("../config/env");

function hasYooKassaConfig() {
  return Boolean(
    process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY,
  );
}

async function yooKassaRequest(path, options = {}) {
  const credentials = Buffer.from(
    `${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET_KEY}`,
  ).toString("base64");
  const response = await fetch(`https://api.yookassa.ru/v3${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      ...(options.idempotenceKey
        ? { "Idempotence-Key": options.idempotenceKey }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.description || "Ошибка запроса ЮKassa");
    error.statusCode = response.status;
    error.response = payload;
    throw error;
  }

  return payload;
}

function buildReturnUrl(order, params = {}) {
  const renderUrl = process.env.RENDER_EXTERNAL_HOSTNAME
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
    : null;
  const base =
    process.env.YOOKASSA_RETURN_URL ||
    `${process.env.PUBLIC_URL || renderUrl || "http://localhost:5173"}/checkout/success`;
  const url = new URL(base);
  url.searchParams.set("orderId", String(order.id));
  url.searchParams.set("paymentMethod", "yookassa");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function verifyPaymentToken(token, orderId) {
  if (!token) return null;
  try {
    const payload = jwt.verify(String(token), jwtSecret);
    if (payload.purpose !== "order_payment") return null;
    if (Number(payload.order_id) !== Number(orderId)) return null;
    return payload;
  } catch {
    return null;
  }
}

function canAccessPaymentOrder(req, order) {
  if (!order) return false;
  if (req.user?.sub && Number(req.user.sub) === Number(order.user_id))
    return true;
  const token = req.body?.payment_token || req.query?.payment_token;
  const payload = verifyPaymentToken(token, order.id);
  if (!payload) return false;
  if (payload.user_id && Number(payload.user_id) !== Number(order.user_id))
    return false;
  if (
    !payload.user_id &&
    String(payload.customer_email || "").toLowerCase() !==
      String(order.customer_email || "").toLowerCase()
  )
    return false;
  return true;
}

async function createPayment(req, res, next) {
  try {
    const orderId = Number(req.body?.orderId);
    const order = await orderModel.getByIdWithItems(orderId);

    if (!order) {
      return res.status(404).json({ error: "Заказ не найден" });
    }
    if (!canAccessPaymentOrder(req, order)) {
      return res.status(403).json({ error: "Нет прав на оплату этого заказа" });
    }
    if (order.payment_status === "paid") {
      return res.status(400).json({ error: "Заказ уже оплачен" });
    }
    if (order.status === "cancelled") {
      return res
        .status(400)
        .json({ error: "Отмененный заказ нельзя оплатить" });
    }

    if (!hasYooKassaConfig()) {
      await pool.query(
        `UPDATE orders
         SET payment_method = 'yookassa', payment_status = 'paid'
         WHERE id = ?`,
        [order.id],
      );
      return res.json({
        paymentId: `demo-${order.id}`,
        confirmationUrl: buildReturnUrl(order, { demoPayment: "paid" }),
        demo: true,
      });
    }

    const payment = await yooKassaRequest("/payments", {
      method: "POST",
      idempotenceKey: crypto.randomUUID(),
      body: {
        amount: {
          value: Number(order.total_amount).toFixed(2),
          currency: "RUB",
        },
        confirmation: {
          type: "redirect",
          return_url: buildReturnUrl(order),
        },
        capture: true,
        description: `Оплата заказа #${order.id}`,
        metadata: {
          order_id: order.id,
        },
      },
    });

    await pool.query(
      `UPDATE orders
       SET payment_method = 'yookassa', payment_status = 'pending'
       WHERE id = ?`,
      [order.id],
    );
    if (order.user_id) {
      await notificationModel.create({
        user_id: order.user_id,
        type: "payment_failed",
        title: `Ожидается оплата заказа #${order.id}`,
        body: 'Если окно оплаты было закрыто, откройте заказ в профиле и нажмите "Оплатить".',
        entity_type: "order",
        entity_id: order.id,
      });
    }

    return res.json({
      paymentId: payment.id,
      confirmationUrl: payment.confirmation.confirmation_url,
    });
  } catch (e) {
    const orderId = Number(req.body?.orderId);
    if (orderId) {
      try {
        const order = await orderModel.getByIdWithItems(orderId);
        if (order?.user_id) {
          await notificationModel.create({
            user_id: order.user_id,
            type: "payment_failed",
            title: `Не удалось перейти к оплате заказа #${orderId}`,
            body: "Заказ сохранён. Откройте его в профиле и попробуйте оплатить ещё раз.",
            entity_type: "order",
            entity_id: orderId,
          });
        }
      } catch (cleanupError) {
        console.error(
          "Payment failure notification error:",
          cleanupError.message,
        );
      }
    }
    if (e.response || e.statusCode || e.status) {
      return res.status(502).json({
        error:
          "Не удалось создать платеж ЮKassa. Заказ сохранён, попробуйте оплатить его из профиля.",
      });
    }
    return next(e);
  }
}

async function checkPayment(req, res, next) {
  try {
    const { paymentId, orderId } = req.query;
    const order = await orderModel.getByIdWithItems(orderId);

    if (!order) {
      return res.status(404).json({ error: "Заказ не найден" });
    }
    if (!canAccessPaymentOrder(req, order)) {
      return res
        .status(403)
        .json({ error: "Нет прав на проверку оплаты этого заказа" });
    }

    if (String(paymentId || "").startsWith("demo-")) {
      await orderModel.updatePaymentStatus(orderId, "paid");
      return res.json({ status: "succeeded", demo: true });
    }

    if (!hasYooKassaConfig()) {
      return res.status(400).json({ error: "Платеж ЮKassa не настроен" });
    }

    const payment = await yooKassaRequest(
      `/payments/${encodeURIComponent(paymentId)}`,
    );

    if (payment.status === "succeeded") {
      await orderModel.updatePaymentStatus(orderId, "paid");
      if (order?.user_id) {
        await notificationModel.create({
          user_id: order.user_id,
          type: "payment_paid",
          title: `Заказ #${orderId} оплачен`,
          body: "Оплата ЮKassa подтверждена.",
          entity_type: "order",
          entity_id: Number(orderId),
        });
      }
    } else if (["canceled", "failed"].includes(payment.status)) {
      await orderModel.updatePaymentStatus(orderId, "failed");
      if (order?.user_id) {
        await notificationModel.create({
          user_id: order.user_id,
          type: "payment_failed",
          title: `Заказ #${orderId} не оплачен`,
          body: "Оплата не завершена. Откройте заказ в профиле и попробуйте оплатить ещё раз.",
          entity_type: "order",
          entity_id: Number(orderId),
        });
      }
    }

    return res.json({ status: payment.status });
  } catch (e) {
    return next(e);
  }
}

module.exports = {
  createPayment,
  checkPayment,
};
