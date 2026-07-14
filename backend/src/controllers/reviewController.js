const { pool } = require("../config/database");
const suspensionModel = require("../models/suspensionModel");
const reviewEligibilityModel = require("../models/reviewEligibilityModel");
const { sendVkNotification } = require("../utils/vk");
const { reviewReportReason } = require("../utils/labels");
const notificationModel = require("../models/notificationModel");

function attachImages(rows, imageRows) {
  const byReview = {};
  for (const im of imageRows) {
    if (!byReview[im.review_id]) byReview[im.review_id] = [];
    byReview[im.review_id].push({ id: im.id, image_path: im.image_path });
  }
  return rows.map((r) => ({
    ...r,
    images: byReview[r.id] || [],
  }));
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

async function list(req, res, next) {
  try {
    const productId = Number(req.params.productId);
    const [rows] = await pool.query(
      `SELECT r.id, r.rating, r.body, r.status, r.created_at, r.updated_at,
              u.id AS user_id, u.first_name, u.last_name, u.email
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ? AND r.status = 'approved'
       ORDER BY r.created_at DESC`,
      [productId],
    );
    const [[{ avg_rating }]] = await pool.query(
      "SELECT AVG(rating) AS avg_rating FROM reviews WHERE product_id = ? AND status = 'approved'",
      [productId],
    );
    let items = rows;
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      const [imgs] = await pool.query(
        "SELECT id, review_id, image_path FROM review_images WHERE review_id IN (?) ORDER BY sort_order ASC, id ASC",
        [ids],
      );
      items = attachImages(rows, imgs);
    }
    res.json({
      items,
      avg_rating: avg_rating ? Number(avg_rating).toFixed(1) : null,
    });
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const userId = Number(req.user.sub);
    const productId = Number(req.params.productId);
    const rating = Number(req.body.rating);
    const body = String(req.body.body || "").trim();

    const summary = await suspensionModel.getReviewRestrictionSummary(userId);
    if (summary.active) {
      await conn.release();
      return res.status(403).json({
        error: "Вы временно лишены возможности оставлять отзывы",
        code: "REVIEW_SUSPENDED",
        review_restriction: restrictionPayload(summary),
      });
    }

    const purchased = await reviewEligibilityModel.getPurchasedUnits(
      userId,
      productId,
    );
    const written = await reviewEligibilityModel.getUserReviewCount(
      userId,
      productId,
    );
    if (purchased <= 0) {
      await conn.release();
      return res.status(403).json({
        error:
          "Оставлять отзывы могут только пользователи, которые покупали этот товар",
      });
    }
    if (written >= purchased) {
      await conn.release();
      return res.status(409).json({
        error:
          "Вы использовали все отзывы по количеству купленных единиц этого товара",
      });
    }

    const [[product]] = await conn.query(
      "SELECT id FROM products WHERE id = ? LIMIT 1",
      [productId],
    );
    if (!product) {
      await conn.release();
      return res.status(404).json({ error: "Товар не найден" });
    }

    await conn.beginTransaction();
    const [res2] = await conn.query(
      "INSERT INTO reviews (product_id, user_id, rating, body) VALUES (?, ?, ?, ?)",
      [productId, userId, rating, body],
    );
    const reviewId = res2.insertId;

    const files = req.files || [];
    const max = Math.min(3, files.length);
    for (let i = 0; i < max; i += 1) {
      const f = files[i];
      const path = `/uploads/${f.filename}`;
      await conn.query(
        "INSERT INTO review_images (review_id, image_path, sort_order) VALUES (?, ?, ?)",
        [reviewId, path, i],
      );
    }

    await conn.commit();
    await conn.release();
    res.status(201).json({ id: reviewId });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* */
    }
    try {
      await conn.release();
    } catch {
      /* */
    }
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const userId = Number(req.user.sub);
    const id = Number(req.params.id);
    const { rating, body } = req.body;

    const [[review]] = await pool.query(
      "SELECT * FROM reviews WHERE id = ? AND status <> 'deleted' LIMIT 1",
      [id],
    );
    if (!review) return res.status(404).json({ error: "Отзыв не найден" });
    if (Number(review.user_id) !== userId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Нет прав для редактирования" });
    }

    await pool.query("UPDATE reviews SET rating = ?, body = ? WHERE id = ?", [
      rating,
      body,
      id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    const userId = Number(req.user.sub);
    const id = Number(req.params.id);

    const [[review]] = await pool.query(
      "SELECT * FROM reviews WHERE id = ? AND status <> 'deleted' LIMIT 1",
      [id],
    );
    if (!review) return res.status(404).json({ error: "Отзыв не найден" });
    if (Number(review.user_id) !== userId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Нет прав для удаления" });
    }

    await pool.query("UPDATE reviews SET status = 'deleted' WHERE id = ?", [
      id,
    ]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function report(req, res, next) {
  try {
    const userId = Number(req.user.sub);
    const id = Number(req.params.id);
    const { reason, comment, review_image_id } = req.body;

    const [[review]] = await pool.query(
      "SELECT r.id, r.user_id, p.name AS product_name FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.id = ? AND r.status <> 'deleted'",
      [id],
    );
    if (!review) return res.status(404).json({ error: "Отзыв не найден" });

    let imageId = null;
    if (review_image_id != null && String(review_image_id).trim() !== "") {
      imageId = Number(review_image_id);
      const [[img]] = await pool.query(
        "SELECT id FROM review_images WHERE id = ? AND review_id = ? LIMIT 1",
        [imageId, id],
      );
      if (!img) {
        return res
          .status(400)
          .json({ error: "Указанное фото не принадлежит этому отзыву" });
      }
    }

    const [[existing]] = await pool.query(
      "SELECT id FROM review_reports WHERE review_id = ? AND user_id = ? AND review_image_id <=> ? LIMIT 1",
      [id, userId, imageId],
    );
    if (existing) {
      return res.status(409).json({ error: "Вы уже отправляли такую жалобу" });
    }

    const [[reporter]] = await pool.query(
      "SELECT email FROM users WHERE id = ?",
      [userId],
    );
    const [[author]] = await pool.query(
      "SELECT email FROM users WHERE id = ?",
      [review.user_id],
    );

    const [ins] = await pool.query(
      `INSERT INTO review_reports (review_id, review_image_id, user_id, reason, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [id, imageId, userId, reason, comment || null],
    );
    const reportId = ins.insertId;
    await notificationModel.createForAdmins({
      type: "review_report",
      title: `Новая жалоба #${reportId}`,
      body: `Товар: ${review.product_name}. Причина: ${reviewReportReason(reason)}`,
      entity_type: "review_report",
      entity_id: reportId,
    });

    try {
      await sendVkNotification("new_review_report", {
        report_id: reportId,
        review_id: id,
        product_name: review.product_name,
        review_author_email: author?.email || "",
        reporter_email: reporter?.email || "",
        reason: reviewReportReason(reason),
        comment: comment || "",
      });
    } catch (e) {
      console.error("VK report notify:", e.message);
    }

    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, create, update, remove, report };
