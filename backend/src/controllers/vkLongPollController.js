const { pool } = require("../config/database");
const orderModel = require("../models/orderModel");
const { sendVkMessage, getAdminVkUserIds } = require("../utils/vk");
const { orderStatus } = require("../utils/labels");

function extractLinkArg(msg) {
  const text = String(msg?.text || "").trim();
  let arg = "";

  if (msg?.payload) {
    try {
      const payload =
        typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload;
      arg = payload.start || payload.ref || "";
    } catch {
      arg = String(msg.payload || "");
    }
  }

  if (!arg && msg?.ref) arg = String(msg.ref);
  if (!arg && msg?.key) arg = String(msg.key);
  if (!arg && (text.includes("link_") || /^[a-f0-9]{32}$/i.test(text)))
    arg = text;

  return arg.trim();
}

function extractLinkCode(arg) {
  if (!arg) return null;
  if (arg.startsWith("link_")) return arg.slice(5);
  if (/^[a-f0-9]{32}$/i.test(arg)) return arg;
  return null;
}

async function bindVkAccount(vkUserId, code) {
  const [[row]] = await pool.query(
    `SELECT user_id
     FROM vk_link_codes
     WHERE code = ? AND expires_at > NOW()
     LIMIT 1`,
    [code],
  );

  if (!row) {
    await sendVkMessage(
      vkUserId,
      "Ссылка недействительна или истекла. Получите новую ссылку в профиле на сайте.",
    );
    return false;
  }

  await pool.query(
    "UPDATE users SET vk_user_id = NULL WHERE vk_user_id = ? AND id <> ?",
    [vkUserId, row.user_id],
  );
  await pool.query("UPDATE users SET vk_user_id = ? WHERE id = ?", [
    vkUserId,
    row.user_id,
  ]);
  await pool.query("DELETE FROM vk_link_codes WHERE user_id = ?", [
    row.user_id,
  ]);

  await sendVkMessage(
    vkUserId,
    "Здравствуйте! VK успешно привязан к аккаунту.\n\nЯ буду присылать уведомления по заказам и заявкам. Для удобства используйте кнопки ниже:\n/orders - ваши заказы\n/admin_reports - жалобы для админов\n/unlink - отвязать VK",
  );
  return true;
}

async function handleStart(vkUserId, msg) {
  const code = extractLinkCode(extractLinkArg(msg));
  if (code) {
    await bindVkAccount(vkUserId, code);
    return;
  }

  await sendVkMessage(
    vkUserId,
    'Здравствуйте! Я бот магазина «Телега».\n\nЧтобы привязать VK, откройте профиль на сайте и нажмите "Получить ссылку для привязки". Если вы уже открыли ссылку из профиля, привязка выполнится автоматически.\n\nКоманды доступны кнопками ниже.',
  );
}

async function tryBindFromMessage(vkUserId, msg) {
  const code = extractLinkCode(extractLinkArg(msg));
  if (!code) return false;
  return bindVkAccount(vkUserId, code);
}

async function handleOrders(vkUserId) {
  const [[user]] = await pool.query(
    "SELECT id FROM users WHERE vk_user_id = ? LIMIT 1",
    [vkUserId],
  );
  if (!user) {
    await sendVkMessage(
      vkUserId,
      "Аккаунт не привязан. Привяжите VK через профиль на сайте.",
    );
    return;
  }

  const data = await orderModel.listByUser(user.id, { page: 1, limit: 8 });
  const orders = data.orders || [];
  if (!orders.length) {
    await sendVkMessage(vkUserId, "Заказов пока нет.");
    return;
  }

  const lines = orders.map(
    (o) =>
      `#${o.id} - ${orderStatus(o.status)} - ${o.total_amount} ₽ - ${new Date(o.created_at).toLocaleString("ru-RU")}`,
  );
  await sendVkMessage(vkUserId, `Ваши заказы:\n\n${lines.join("\n")}`);
}

async function handleAdminReports(vkUserId) {
  const admins = await getAdminVkUserIds();
  if (!admins.includes(String(vkUserId))) {
    await sendVkMessage(vkUserId, "Команда доступна только администраторам.");
    return;
  }
  const [[reports]] = await pool.query(
    "SELECT COUNT(*) AS c FROM review_reports WHERE status = 'pending'",
  );
  await sendVkMessage(vkUserId, `Жалоб в очереди: ${reports.c}`);
}

async function handleUnlink(vkUserId) {
  const [[user]] = await pool.query(
    "SELECT id FROM users WHERE vk_user_id = ? LIMIT 1",
    [vkUserId],
  );
  if (!user) {
    await sendVkMessage(vkUserId, "Этот VK не привязан к аккаунту.");
    return;
  }
  await pool.query("UPDATE users SET vk_user_id = NULL WHERE id = ?", [
    user.id,
  ]);
  await sendVkMessage(vkUserId, "VK отвязан от аккаунта.");
}

async function handleVkUpdate(type, object) {
  if (type === "message_allow") {
    const vkUserId = object?.user_id;
    const key = object?.key || object?.ref || "";
    if (vkUserId && key)
      await handleStart(vkUserId, { key, ref: key, text: "" });
    return;
  }

  if (type !== "message_new") return;

  const msg = object?.message || {};
  const vkUserId = msg?.from_id;
  if (!vkUserId) return;

  const didBind = await tryBindFromMessage(vkUserId, msg);
  if (didBind) return;

  const text = String(msg?.text || "").trim();
  const cmd = text.toLowerCase();

  if (cmd.startsWith("/start") || cmd.startsWith("start") || cmd === "начать") {
    await handleStart(vkUserId, msg);
  } else if (cmd === "/orders" || cmd === "orders") {
    await handleOrders(vkUserId);
  } else if (cmd === "/admin_reports" || cmd === "admin_reports") {
    await handleAdminReports(vkUserId);
  } else if (cmd === "/unlink" || cmd === "unlink") {
    await handleUnlink(vkUserId);
  } else if (text) {
    await sendVkMessage(
      vkUserId,
      "Неизвестная команда. Доступно: /orders, /admin_reports, /unlink",
    );
  }
}

module.exports = { handleVkUpdate };
