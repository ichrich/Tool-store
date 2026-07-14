const { pool } = require("../config/database");
const productModel = require("../models/productModel");
const orderModel = require("../models/orderModel");
const discountModel = require("../models/discountModel");
const notificationModel = require("../models/notificationModel");
const { sendVkNotification } = require("../utils/vk");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");

const PAYMENT_LABELS = {
  cash: "Наличными при получении",
  yookassa: "ЮKassa",
};

const CANCEL_REASON_LABELS = {
  changed_mind: "Покупатель передумал",
  wrong_contacts: "Неверные контактные данные",
  wrong_address: "Неверный адрес",
  duplicate: "Повторный заказ",
  too_long: "Долгое ожидание обработки",
  other: "Другая причина",
};

function makePaymentToken(orderId, orderRow) {
  return jwt.sign(
    {
      purpose: "order_payment",
      order_id: Number(orderId),
      user_id: orderRow.user_id ? Number(orderRow.user_id) : null,
      customer_email: orderRow.customer_email,
    },
    jwtSecret,
    { expiresIn: "2h" },
  );
}

async function create(req, res, next) {
  try {
    const {
      customer_name,
      customer_email,
      customer_phone,
      customer_company,
      address,
      notes,
      payment_method,
      delivery_time,
      promo_code,
      items,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Корзина пуста" });
    }

    const productIds = [
      ...new Set(items.map((i) => Number(i.product_id))),
    ].filter((id) => Number.isInteger(id) && id > 0);
    if (productIds.length !== items.length && productIds.length === 0) {
      return res.status(400).json({
        code: "PRODUCT_NOT_FOUND",
        error: "В корзине есть товары, которые больше не доступны",
        fields: { cart: "Обновите корзину и повторите оформление" },
        missing_product_ids: items
          .map((i) => Number(i.product_id))
          .filter((id) => Number.isInteger(id) && id > 0),
      });
    }
    const [products] = await pool.query(
      `SELECT id, name, slug, price, stock, is_deleted FROM products WHERE id IN (${productIds.map(() => "?").join(",")})`,
      productIds,
    );
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    const missingProductIds = productIds.filter((id) => !byId[id]);
    if (missingProductIds.length > 0) {
      return res.status(400).json({
        code: "PRODUCT_NOT_FOUND",
        error: "Некоторые товары из корзины больше не найдены",
        fields: { cart: "Удалите недоступные товары и повторите оформление" },
        missing_product_ids: missingProductIds,
      });
    }

    const normalized = [];
    for (const line of items) {
      const pid = Number(line.product_id);
      const qty = Math.min(999, Math.max(1, Number(line.quantity) || 1));
      const p = byId[pid];
      if (!p) {
        return res.status(400).json({ error: `Товар не найден (id: ${pid})` });
      }
      if (p.is_deleted) {
        return res
          .status(400)
          .json({ error: `Товар "${p.name}" больше не доступен` });
      }
      if (Number(p.price) <= 0) {
        return res
          .status(400)
          .json({ error: `Товар "${p.name}" временно недоступен для заказа` });
      }
      if (p.stock < qty) {
        return res.status(400).json({
          error: `Недостаточно товара "${p.name}". Доступно: ${p.stock}`,
          fields: { [`item_${pid}`]: `Доступно только ${p.stock} шт.` },
        });
      }
      normalized.push({
        product_id: pid,
        quantity: qty,
        unit_price: Number(p.price),
        product_name_snapshot: p.name,
      });
    }

    const subtotal = normalized.reduce(
      (s, it) => s + it.unit_price * it.quantity,
      0,
    );
    let discount_amount = 0;
    let applied_promo = null;
    if (promo_code && String(promo_code).trim()) {
      const userId = req.user?.sub || null;
      const disc = await discountModel.findValidCode(
        String(promo_code).trim(),
        subtotal,
        userId,
        normalized,
      );
      if (!disc) {
        return res.status(400).json({
          error: "Промокод недействителен или не применим к этому заказу",
          fields: { promo_code: "Проверьте код и минимальную сумму заказа" },
        });
      }
      const applicableTotal = Number(disc.applicable_total ?? subtotal);
      discount_amount =
        disc.type === "percent"
          ? Math.round(((applicableTotal * disc.value) / 100) * 100) / 100
          : Math.min(applicableTotal, disc.value);
      applied_promo = String(promo_code).trim();
    }

    const orderPayload = {
      user_id: req.user?.sub != null ? Number(req.user.sub) : null,
      customer_name,
      customer_email,
      customer_phone,
      customer_company,
      address,
      notes,
      payment_method,
      delivery_time,
      discount_amount,
      promo_code: applied_promo,
      payment_status: "pending",
    };
    const orderId = await orderModel.createOrderWithItems(
      orderPayload,
      normalized,
    );

    // Update promo usage
    if (applied_promo) {
      await discountModel.incrementUsage(applied_promo);
    }

    // Clear server-side cart if logged in
    if (req.user?.sub) {
      await pool.query("DELETE FROM cart_items WHERE user_id = ?", [
        req.user.sub,
      ]);
    }

    // VK notification
    try {
      const order = await orderModel.getByIdWithItems(orderId);
      await notificationModel.createForAdmins({
        type: "order_created",
        title: `Новый заказ #${order.id}`,
        body: `${order.customer_name}, сумма ${order.total_amount}`,
        entity_type: "order",
        entity_id: order.id,
      });
      if (order.user_id) {
        await notificationModel.create({
          user_id: order.user_id,
          type: "order_created",
          title: `Заказ #${order.id} оформлен`,
          body:
            order.payment_method === "yookassa"
              ? "Мы приняли заказ. Для обработки нужно завершить оплату ЮKassa."
              : "Мы приняли заказ и скоро обновим его статус.",
          entity_type: "order",
          entity_id: order.id,
        });
      }
      await sendVkNotification("new_order", order);
      await sendVkNotification("order_thanks_user", order);
    } catch (e) {
      console.error("VK notification error:", e.message);
    }

    res.status(201).json({
      id: orderId,
      payment_token: makePaymentToken(orderId, orderPayload),
      message: "Заявка принята",
    });
  } catch (e) {
    next(e);
  }
}

async function cancelMyOrder(req, res, next) {
  try {
    const id = Number(req.params.id);
    const uid = Number(req.user.sub);
    const result = await orderModel.cancelByUser(id, uid);
    if (!result.ok) {
      const messages = {
        not_found: "Заказ не найден",
        not_cancellable: "Этот заказ уже нельзя отменить самостоятельно",
        paid_requires_admin:
          "Оплаченный заказ нельзя отменить без обработки администратором",
      };
      return res
        .status(result.code === "not_found" ? 404 : 400)
        .json({ error: messages[result.code] || "Не удалось отменить заказ" });
    }
    await notificationModel.createForAdmins({
      type: "order_status",
      title: `Заказ #${id} отменен покупателем`,
      body: `Пользователь #${uid} отменил заказ.`,
      entity_type: "order",
      entity_id: id,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function requestCancelMyOrder(req, res, next) {
  try {
    const id = Number(req.params.id);
    const uid = Number(req.user.sub);
    const order = await orderModel.getByIdWithItems(id);
    if (!order || Number(order.user_id) !== uid) {
      return res.status(404).json({ error: "Заказ не найден" });
    }
    if (order.status !== "processing") {
      return res.status(400).json({
        error: "Заявка на отмену нужна только для заказа в обработке",
      });
    }
    const reason = String(req.body?.reason || "other").trim();
    const comment = String(req.body?.comment || "").trim();
    const request = await orderModel.createCancelRequest({
      orderId: id,
      userId: uid,
      reason,
      comment,
    });
    await notificationModel.createForAdmins({
      type: "order_status",
      title: `Заявка на отмену заказа #${id}`,
      body: `${order.customer_name}. Способ оплаты: ${PAYMENT_LABELS[order.payment_method] || order.payment_method}. ${comment || CANCEL_REASON_LABELS[reason] || "Причина не указана"}`,
      entity_type: "order",
      entity_id: id,
    });
    await notificationModel.create({
      user_id: uid,
      type: "order_status",
      title: `Заявка на отмену заказа #${id} отправлена`,
      body:
        order.payment_method === "cash"
          ? "Администратор рассмотрит заявку. Возврат денег не требуется, так как выбрана оплата наличными."
          : "Администратор рассмотрит заявку и при одобрении отменит заказ с возвратом средств.",
      entity_type: "order",
      entity_id: id,
    });
    res.json({ ok: true, id: request.id, existed: request.existed });
  } catch (e) {
    next(e);
  }
}

async function myOrders(req, res, next) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = await orderModel.listByUser(Number(req.user.sub), {
      page,
      limit,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
}

async function myOrderDetail(req, res, next) {
  try {
    const uid = Number(req.user.sub);
    const order = await orderModel.getByIdWithItems(Number(req.params.id));
    if (!order || Number(order.user_id) !== uid) {
      return res.status(404).json({ error: "Заказ не найден" });
    }
    res.json(order);
  } catch (e) {
    next(e);
  }
}

async function simulatePayment(req, res, next) {
  try {
    const uid = Number(req.user.sub);
    const id = Number(req.params.id);
    const ok = Boolean(req.body?.success);
    const order = await orderModel.getByIdWithItems(id);
    if (!order || Number(order.user_id) !== uid) {
      return res.status(404).json({ error: "Заказ не найден" });
    }
    if (order.payment_status !== "pending") {
      return res.status(400).json({ error: "Статус оплаты уже зафиксирован" });
    }
    await orderModel.updatePaymentStatus(id, ok ? "paid" : "failed");
    res.json({ payment_status: ok ? "paid" : "failed" });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  create,
  myOrders,
  myOrderDetail,
  simulatePayment,
  cancelMyOrder,
  requestCancelMyOrder,
};
