const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const suspensionModel = require("../models/suspensionModel");
const { pool } = require("../config/database");
const { jwtSecret, jwtExpiresIn } = require("../config/env");
const {
  makeVkCode,
  makeVkStartLink,
  normalizeVkGroupId,
} = require("../utils/vk");

function makeToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: jwtExpiresIn },
  );
}

function makeAppealToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, purpose: "blocked_appeal" },
    jwtSecret,
    { expiresIn: "30m" },
  );
}

async function getLatestAppealSummary(userId) {
  const [[appeal]] = await pool.query(
    `SELECT status, admin_note, resolved_at, created_at
     FROM unblock_appeals
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  return appeal || null;
}

function restrictionPayload(summary) {
  if (!summary || !summary.active) return null;
  return {
    active: true,
    permanent: summary.permanent,
    expires_at: summary.expires_at ? summary.expires_at.toISOString() : null,
    reasons: summary.reasons,
  };
}

async function attachReviewRestriction(userRow) {
  const s = await suspensionModel.getReviewRestrictionSummary(userRow.id);
  return { ...userRow, review_restriction: restrictionPayload(s) };
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }
    if (!user.is_active) {
      const appeal = await getLatestAppealSummary(user.id);
      const rejectedReason =
        appeal?.status === "rejected" ? appeal.admin_note : null;
      return res.status(403).json({
        error:
          rejectedReason ||
          process.env.BLOCKED_USER_MESSAGE ||
          "Ваш аккаунт заблокирован. Для разблокировки свяжитесь с поддержкой: support@telega.ru",
        code: "ACCOUNT_BLOCKED",
        appeal_token: makeAppealToken(user),
        appeal_status: appeal?.status || null,
        appeal_rejection_reason: rejectedReason,
      });
    }
    const token = makeToken(user);
    const base = {
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone,
      vk_user_id: user.vk_user_id,
    };
    const withRest = await attachReviewRestriction(base);
    return res.json({ token, user: withRest });
  } catch (e) {
    return next(e);
  }
}

async function register(req, res, next) {
  try {
    const { email, password, first_name, last_name, phone } = req.body;

    const exists = await userModel.emailExists(email);
    if (exists) {
      return res.status(409).json({
        error: "Пользователь с таким email уже зарегистрирован",
        fields: { email: "Email уже занят" },
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const id = await userModel.create({
      email,
      password_hash,
      role: "user",
      first_name,
      last_name,
      phone,
    });
    const user = await userModel.findById(id);
    const token = makeToken(user);

    return res.status(201).json({
      token,
      user: await attachReviewRestriction({
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        vk_user_id: user.vk_user_id,
      }),
    });
  } catch (e) {
    return next(e);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await userModel.findById(req.user.sub);
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    res.json(await attachReviewRestriction(user));
  } catch (e) {
    next(e);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { first_name, last_name, phone, email, password, current_password } =
      req.body;
    const userId = req.user.sub;

    const current = await userModel.findByIdWithPassword(userId);
    if (!current)
      return res.status(404).json({ error: "Пользователь не найден" });

    const emailChanging =
      email !== undefined &&
      String(email).trim() &&
      String(email).trim() !== current.email;
    const phoneChanging =
      phone !== undefined &&
      String(phone || "").trim() !== String(current.phone || "").trim();

    if (emailChanging || phoneChanging) {
      if (!current_password) {
        return res.status(400).json({
          error: "Для смены email или телефона введите текущий пароль",
          fields: { current_password: "Укажите пароль для подтверждения" },
        });
      }
      const okCred = await bcrypt.compare(
        current_password,
        current.password_hash,
      );
      if (!okCred) {
        return res.status(400).json({
          error: "Неверный пароль",
          fields: { current_password: "Неверный пароль" },
        });
      }
    }

    const updateData = {};
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (phone !== undefined) updateData.phone = phone;

    if (emailChanging) {
      const exists = await userModel.emailExists(String(email).trim(), userId);
      if (exists) {
        return res.status(409).json({
          error: "Email уже занят",
          fields: { email: "Email уже используется другим пользователем" },
        });
      }
      updateData.email = String(email).trim();
    }

    if (password) {
      if (!current_password) {
        return res.status(400).json({
          error: "Введите текущий пароль",
          fields: {
            current_password: "Для смены пароля укажите текущий пароль",
          },
        });
      }
      const ok = await bcrypt.compare(current_password, current.password_hash);
      if (!ok) {
        return res.status(400).json({
          error: "Неверный текущий пароль",
          fields: { current_password: "Неверный текущий пароль" },
        });
      }
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    await userModel.update(userId, updateData);
    const updated = await userModel.findById(userId);
    res.json(await attachReviewRestriction(updated));
  } catch (e) {
    next(e);
  }
}

async function createVkLinkCode(req, res, next) {
  try {
    const userId = Number(req.user.sub);

    if (!normalizeVkGroupId(process.env.VK_GROUP_ID)) {
      return res.status(503).json({
        success: false,
        error:
          "VK_GROUP_ID не задан в backend/.env. Укажите числовой ID сообщества VK (без минуса), затем перезапустите сервер.",
      });
    }

    const code = makeVkCode();
    await pool.query(
      "DELETE FROM vk_link_codes WHERE user_id = ? OR expires_at < NOW()",
      [userId],
    );
    await pool.query(
      "INSERT INTO vk_link_codes (user_id, code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))",
      [userId, code],
    );

    const link = makeVkStartLink(code);
    console.log("VK LINK GENERATED:", { code, link });

    if (!link) {
      return res.status(503).json({
        success: false,
        error:
          "Не удалось сформировать ссылку VK. Проверьте VK_GROUP_ID в backend/.env.",
        code,
      });
    }

    res.json({
      success: true,
      code,
      link,
    });
  } catch (e) {
    next(e);
  }
}

async function createBlockedAppeal(req, res, next) {
  try {
    const token = String(req.body.appeal_token || "").trim();
    const message = String(req.body.message || "").trim();
    if (!token)
      return res.status(400).json({ error: "Токен апелляции не передан" });
    if (!message)
      return res.status(400).json({ error: "Укажите текст апелляции" });

    let payload;
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch {
      return res.status(401).json({
        error: "Срок ссылки на апелляцию истёк. Попробуйте войти ещё раз.",
      });
    }
    if (payload.purpose !== "blocked_appeal") {
      return res.status(403).json({ error: "Недопустимый токен апелляции" });
    }

    const userId = Number(payload.sub);
    const [[user]] = await pool.query(
      "SELECT id, email, is_active FROM users WHERE id = ? LIMIT 1",
      [userId],
    );
    if (!user) return res.status(404).json({ error: "Пользователь не найден" });
    if (user.is_active)
      return res.status(400).json({ error: "Аккаунт уже активен" });

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
      `INSERT INTO unblock_appeals (user_id, message)
       VALUES (?, ?)`,
      [userId, message],
    );

    const notificationModel = require("../models/notificationModel");
    await notificationModel.createForAdmins({
      type: "appeal_created",
      title: `Новая апелляция #${ins.insertId}`,
      body: `Пользователь ${user.email} просит пересмотреть блокировку.`,
      entity_type: "unblock_appeal",
      entity_id: ins.insertId,
    });

    res.status(201).json({ id: ins.insertId });
  } catch (e) {
    next(e);
  }
}

async function unlinkVk(req, res, next) {
  try {
    await userModel.update(Number(req.user.sub), { vk_user_id: null });
    const updated = await userModel.findById(Number(req.user.sub));
    res.json(await attachReviewRestriction(updated));
  } catch (e) {
    next(e);
  }
}

module.exports = {
  login,
  register,
  getMe,
  updateProfile,
  createVkLinkCode,
  unlinkVk,
  createBlockedAppeal,
};
