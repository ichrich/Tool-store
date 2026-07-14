const notificationModel = require("../models/notificationModel");

async function list(req, res, next) {
  try {
    res.json(await notificationModel.listForUser(Number(req.user.sub)));
  } catch (e) {
    next(e);
  }
}

async function markRead(req, res, next) {
  try {
    const ok = await notificationModel.markRead(
      Number(req.user.sub),
      Number(req.params.id),
    );
    if (!ok) return res.status(404).json({ error: "Уведомление не найдено" });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, markRead };
