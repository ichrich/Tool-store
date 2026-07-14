const orderModel = require("../models/orderModel");
const { sendVkNotification } = require("../utils/vk");
const notificationModel = require("../models/notificationModel");

const STATUS_LABELS = {
  new: "Новый",
  processing: "В обработке",
  completed: "Выполнен",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

async function list(req, res, next) {
  try {
    const {
      status,
      search = "",
      page = 1,
      limit = 20,
      sort = "created_at",
      order = "desc",
    } = req.query;
    const data = await orderModel.listAdmin({
      status,
      search,
      page,
      limit,
      sort,
      order,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await orderModel.getByIdWithItems(Number(req.params.id));
    if (!row) {
      return res.status(404).json({ error: "Заказ не найден" });
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
}

async function updateStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const row = await orderModel.getByIdWithItems(id);
    if (!row) {
      return res.status(404).json({ error: "Заказ не найден" });
    }
    if (status === "cancelled") {
      await orderModel.cancelByAdmin(id);
    } else {
      await orderModel.updateStatus(id, status);
    }
    const statusLabel = STATUS_LABELS[status] || status;
    const reviewReady = ["completed", "delivered"].includes(status);
    if (row.user_id) {
      await notificationModel.create({
        user_id: row.user_id,
        type: reviewReady ? "order_delivered" : "order_status",
        title: reviewReady
          ? `Заказ #${id} выполнен`
          : `Статус заказа #${id} изменился`,
        body: reviewReady
          ? "Заказ выполнен. Вы можете оставить отзыв о полученных товарах."
          : `Новый статус: ${statusLabel}`,
        entity_type: "order",
        entity_id: id,
      });
    }

    // VK notification
    try {
      await sendVkNotification("order_status", { ...row, status });
    } catch (e) {
      console.error("VK notification error:", e.message);
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function updateAdminNote(req, res, next) {
  try {
    const id = Number(req.params.id);
    const row = await orderModel.getByIdWithItems(id);
    if (!row) {
      return res.status(404).json({ error: "Заказ не найден" });
    }
    if (
      ["completed", "delivered"].includes(status) &&
      row.payment_method === "yookassa" &&
      row.payment_status !== "paid"
    ) {
      if (row.user_id) {
        await notificationModel.create({
          user_id: row.user_id,
          type: "payment_failed",
          title: `Требуется оплата заказа #${id}`,
          body: "Заказ нельзя завершить, пока оплата ЮKassa не подтверждена. Перейдите в профиль, откройте заказ и оплатите его.",
          entity_type: "order",
          entity_id: id,
        });
      }
      return res
        .status(400)
        .json({ error: "Нельзя завершить заказ ЮKassa, пока он не оплачен" });
    }
    await orderModel.updateAdminNote(
      id,
      String(req.body.admin_note || "").trim(),
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, getOne, updateStatus, updateAdminNote };
