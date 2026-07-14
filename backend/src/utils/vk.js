const crypto = require("crypto");
const fetch = require("node-fetch");
const { orderStatus } = require("./labels");
const { pool } = require("../config/database");

const VK_API_VERSION = "5.199";

function normalizeVkGroupId(raw) {
  if (raw === undefined || raw === null) return null;
  const digits = String(raw).trim().replace(/\D/g, "");
  return digits || null;
}

function isVkConfigured() {
  return Boolean(
    process.env.VK_BOT_TOKEN && normalizeVkGroupId(process.env.VK_GROUP_ID),
  );
}

async function vkApi(method, params = {}) {
  const token = process.env.VK_BOT_TOKEN;
  if (!token) return null;

  const body = new URLSearchParams({
    ...params,
    access_token: token,
    v: VK_API_VERSION,
  });

  const res = await fetch(`https://api.vk.com/method/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`VK API error: ${JSON.stringify(data.error)}`);
  }
  return data.response;
}

function formatOrderLines(order) {
  return (order.items || [])
    .map((it) => {
      const amount = Number(it.unit_price) * Number(it.quantity);
      return `- ${it.product_name_snapshot} x ${it.quantity} = ${amount} ₽`;
    })
    .join("\n");
}

function defaultKeyboard() {
  return JSON.stringify({
    one_time: false,
    inline: false,
    buttons: [
      [
        {
          action: { type: "text", label: "/orders" },
          color: "primary",
        },
        {
          action: { type: "text", label: "/admin_reports" },
          color: "secondary",
        },
      ],
      [
        {
          action: { type: "text", label: "/unlink" },
          color: "negative",
        },
      ],
    ],
  });
}

async function sendVkMessage(userId, message, keyboard = defaultKeyboard()) {
  if (!userId || !isVkConfigured()) return;
  const params = {
    user_id: String(userId),
    random_id: Math.floor(Math.random() * 2147483647),
    message,
  };
  if (keyboard) params.keyboard = keyboard;
  await vkApi("messages.send", params);
}

async function getAdminVkUserIds() {
  const env = process.env.VK_ADMIN_USER_IDS;
  if (env && String(env).trim()) {
    return String(env)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  try {
    const [rows] = await pool.query(
      "SELECT vk_user_id FROM users WHERE role = 'admin' AND vk_user_id IS NOT NULL",
    );
    return rows.map((r) => String(r.vk_user_id));
  } catch {
    return [];
  }
}

async function notifyAdmins(message) {
  const ids = await getAdminVkUserIds();
  for (const id of ids) {
    try {
      await sendVkMessage(id, message);
    } catch (e) {
      console.error("VK notify admin error:", e.message);
    }
  }
}

async function notifyUserById(userId, message) {
  const [[u]] = await pool.query(
    "SELECT vk_user_id FROM users WHERE id = ? LIMIT 1",
    [userId],
  );
  if (!u?.vk_user_id) return;
  try {
    await sendVkMessage(u.vk_user_id, message);
  } catch (e) {
    console.error("VK notify user error:", e.message);
  }
}

async function sendVkNotification(type, data) {
  if (!isVkConfigured()) return;

  if (type === "new_order") {
    const o = data;
    const itemsList = formatOrderLines(o);
    const text = [
      `Новый заказ #${o.id}`,
      `${o.customer_name} (${o.customer_email})`,
      `Телефон: ${o.customer_phone}`,
      o.address ? `Адрес: ${o.address}` : "",
      o.delivery_time ? `Время доставки: ${o.delivery_time}` : "",
      "",
      "Состав:",
      itemsList,
      "",
      o.discount_amount > 0 ? `Скидка: -${o.discount_amount} ₽` : "",
      `Итого: ${o.total_amount} ₽`,
    ]
      .filter(Boolean)
      .join("\n");
    await notifyAdmins(text);
    return;
  }

  if (type === "order_status") {
    await notifyAdmins(
      `Заказ #${data.id} обновлён\nСтатус: ${orderStatus(data.status)}`,
    );
    return;
  }

  if (type === "new_review_report") {
    const r = data;
    const text = [
      `Жалоба на отзыв #${r.report_id}`,
      `Отзыв #${r.review_id}, товар: ${r.product_name}`,
      `Автор отзыва: ${r.review_author_email}`,
      `Жалоба от: ${r.reporter_email}`,
      `Причина: ${r.reason}`,
      r.comment ? `Комментарий: ${r.comment}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await notifyAdmins(text);
    return;
  }

  if (type === "order_thanks_user") {
    const o = data;
    await notifyUserById(
      o.user_id,
      `Спасибо за заказ!\n\nЗаказ #${o.id}\nСумма: ${o.total_amount} ₽\n\nМы скоро свяжемся с вами.`,
    );
  }
}

function makeVkCode() {
  return crypto.randomBytes(16).toString("hex");
}

function makeVkStartLink(code) {
  const groupId = normalizeVkGroupId(process.env.VK_GROUP_ID);
  if (!groupId) return null;
  const publicName = String(process.env.VK_PUBLIC_SCREEN_NAME || "")
    .trim()
    .replace(/^@/, "");
  const peer = publicName || `public${groupId}`;
  return `https://vk.me/${encodeURIComponent(peer)}?ref=link_${encodeURIComponent(code)}`;
}

module.exports = {
  isVkConfigured,
  normalizeVkGroupId,
  vkApi,
  sendVkMessage,
  sendVkNotification,
  getAdminVkUserIds,
  notifyAdmins,
  notifyUserById,
  makeVkStartLink,
  makeVkCode,
};
