const { pool } = require("../config/database");
const notificationModel = require("../models/notificationModel");

const REVIEW_SORT = {
  created_at: "r.created_at",
  id: "r.id",
  product_name: "p.name",
  user_email: "u.email",
  rating: "r.rating",
  status: "r.status",
};

async function list(req, res, next) {
  try {
    const {
      page = 1,
      limit = 25,
      status = "all",
      search = "",
      product_id = "",
      sort = "created_at",
      order = "desc",
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const lim = Number(limit);

    const conditions = ["r.status <> 'deleted'"];
    const params = [];
    if (status === "pending") {
      conditions.push("r.status = 'pending'");
    } else if (status === "approved") {
      conditions.push("r.status = 'approved'");
    } else if (status === "rejected") {
      conditions.push("r.status = 'rejected'");
    }
    if (product_id) {
      conditions.push("r.product_id = ?");
      params.push(Number(product_id));
    }
    if (search) {
      conditions.push("(p.name LIKE ? OR u.email LIKE ? OR r.body LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const sortCol = REVIEW_SORT[sort] || REVIEW_SORT.created_at;
    const sortDir = String(order).toLowerCase() === "asc" ? "ASC" : "DESC";

    const [rows] = await pool.query(
      `SELECT r.*, p.name AS product_name, p.slug AS product_slug, u.email AS user_email
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       JOIN users u ON u.id = r.user_id
       ${where}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, lim, offset],
    );
    const [[{ c }]] = await pool.query(
      `SELECT COUNT(*) AS c FROM reviews r JOIN products p ON p.id = r.product_id JOIN users u ON u.id = r.user_id ${where}`,
      params,
    );
    res.json({ items: rows, total: c });
  } catch (e) {
    next(e);
  }
}

async function approve(req, res, next) {
  try {
    const [[review]] = await pool.query(
      "SELECT id, user_id FROM reviews WHERE id = ? LIMIT 1",
      [req.params.id],
    );
    await pool.query("UPDATE reviews SET status = 'approved' WHERE id = ?", [
      req.params.id,
    ]);
    if (review?.user_id) {
      await notificationModel.create({
        user_id: review.user_id,
        type: "review_report",
        title: `Отзыв #${review.id} одобрен`,
        body: "Ваш отзыв прошёл модерацию и опубликован.",
        entity_type: "review",
        entity_id: review.id,
      });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function reject(req, res, next) {
  try {
    const [[review]] = await pool.query(
      "SELECT id, user_id FROM reviews WHERE id = ? LIMIT 1",
      [req.params.id],
    );
    await pool.query("UPDATE reviews SET status = 'rejected' WHERE id = ?", [
      req.params.id,
    ]);
    if (review?.user_id) {
      await notificationModel.create({
        user_id: review.user_id,
        type: "review_report",
        title: `Отзыв #${review.id} отклонён`,
        body: "Ваш отзыв отклонён модератором.",
        entity_type: "review",
        entity_id: review.id,
      });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    const [[review]] = await pool.query(
      "SELECT id, user_id FROM reviews WHERE id = ? LIMIT 1",
      [req.params.id],
    );
    await pool.query("UPDATE reviews SET status = 'deleted' WHERE id = ?", [
      req.params.id,
    ]);
    if (review?.user_id) {
      await notificationModel.create({
        user_id: review.user_id,
        type: "review_report",
        title: `Отзыв #${review.id} удалён`,
        body: "Ваш отзыв удалён модератором.",
        entity_type: "review",
        entity_id: review.id,
      });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function listReports(req, res, next) {
  try {
    const {
      archive,
      search = "",
      page = 1,
      limit = 25,
      sort = "created_at",
      order = "desc",
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const lim = Number(limit);

    const isArchive = archive === "true" || archive === "1";
    const statusWhere = isArchive
      ? "rr.status IN ('reviewed','dismissed')"
      : "rr.status = 'pending'";

    const sortMap = {
      created_at: "rr.created_at",
      id: "rr.id",
      reason: "rr.reason",
      status: "rr.status",
    };
    const sortCol = sortMap[sort] || sortMap.created_at;
    const sortDir = String(order).toLowerCase() === "asc" ? "ASC" : "DESC";

    const searchSql = search
      ? ` AND (p.name LIKE ? OR rr.comment LIKE ? OR pu.email LIKE ? OR u.email LIKE ? OR rr.id = ? OR rr.review_id = ?)`
      : "";
    const queryParams = search
      ? [
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          Number(search) || 0,
          Number(search) || 0,
          lim,
          offset,
        ]
      : [lim, offset];

    const [rows] = await pool.query(
      `SELECT rr.*, r.body AS review_body, r.rating, r.id AS review_id, r.product_id,
              u.email AS reporter_email,
              pu.email AS reviewed_user_email,
              p.name AS product_name, p.slug AS product_slug,
              ri.image_path AS reported_image_path,
              (SELECT COUNT(*) FROM user_suspensions s
               WHERE s.user_id = pu.id AND s.expires_at IS NULL) AS author_perm_susp_count,
              (SELECT MAX(s.expires_at) FROM user_suspensions s
               WHERE s.user_id = pu.id AND s.expires_at IS NOT NULL AND s.expires_at > NOW()) AS author_suspension_until
       FROM review_reports rr
       JOIN reviews r ON r.id = rr.review_id
       JOIN users u ON u.id = rr.user_id
       JOIN users pu ON pu.id = r.user_id
       JOIN products p ON p.id = r.product_id
       LEFT JOIN review_images ri ON ri.id = rr.review_image_id
       WHERE ${statusWhere}${searchSql}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT ? OFFSET ?`,
      queryParams,
    );
    const countParams = search
      ? [
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          `%${search}%`,
          Number(search) || 0,
          Number(search) || 0,
        ]
      : [];
    const [[{ c }]] = await pool.query(
      `SELECT COUNT(*) AS c
       FROM review_reports rr
       JOIN reviews r ON r.id = rr.review_id
       JOIN users u ON u.id = rr.user_id
       JOIN users pu ON pu.id = r.user_id
       JOIN products p ON p.id = r.product_id
       WHERE ${statusWhere}${searchSql}`,
      countParams,
    );
    res.json({ items: rows, total: c });
  } catch (e) {
    next(e);
  }
}

async function resolveReport(req, res, next) {
  let conn;
  try {
    const reportId = Number(req.params.id);
    const { action, sanction, sanction_days, admin_note, delete_all_reviews } =
      req.body;
    const adminId = Number(req.user.sub);

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [[row]] = await conn.query(
      `SELECT rr.id, rr.status, rr.review_id, rr.user_id AS reporter_id,
              r.user_id AS review_author_id, p.name AS product_name
       FROM review_reports rr
       JOIN reviews r ON r.id = rr.review_id
       JOIN products p ON p.id = r.product_id
       WHERE rr.id = ? FOR UPDATE`,
      [reportId],
    );
    if (!row) {
      await conn.rollback();
      return res.status(404).json({ error: "Жалоба не найдена" });
    }
    if (row.status !== "pending") {
      await conn.rollback();
      return res.status(400).json({ error: "Жалоба уже обработана" });
    }

    if (action === "dismiss") {
      await conn.query(
        `UPDATE review_reports SET status = 'dismissed', resolved_at = NOW(), resolved_by_admin_id = ?,
         reviewer_sanction = 'none', sanction_days = NULL, admin_note = ?
         WHERE id = ?`,
        [adminId, admin_note || null, reportId],
      );
    } else if (action === "accept") {
      await conn.query("UPDATE reviews SET status = 'rejected' WHERE id = ?", [
        row.review_id,
      ]);

      if (sanction !== "review_ban_days" && sanction !== "account_block") {
        await conn.rollback();
        return res.status(400).json({
          error:
            "Выберите меру: ограничение отзывов на N дней или блокировка аккаунта",
        });
      }

      let reviewerSanction = "none";
      let days = null;

      if (sanction === "review_ban_days") {
        const d = Math.min(3650, Math.max(1, Number(sanction_days) || 0));
        if (!d) {
          await conn.rollback();
          return res
            .status(400)
            .json({ error: "Укажите число дней ограничения (1–3650)" });
        }
        reviewerSanction = "review_ban";
        days = d;
        await conn.query(
          `INSERT INTO user_suspensions (user_id, admin_id, reason, expires_at)
           VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
          [
            row.review_author_id,
            adminId,
            admin_note || "Ограничение по жалобе на отзыв",
            d,
          ],
        );
      } else if (sanction === "account_block") {
        reviewerSanction = "account_block";
        await conn.query("UPDATE users SET is_active = 0 WHERE id = ?", [
          row.review_author_id,
        ]);
        if (delete_all_reviews === true || delete_all_reviews === "true") {
          await conn.query(
            "UPDATE reviews SET status = 'deleted' WHERE user_id = ?",
            [row.review_author_id],
          );
        }
      }

      await conn.query(
        `UPDATE review_reports SET status = 'reviewed', resolved_at = NOW(), resolved_by_admin_id = ?,
         reviewer_sanction = ?, sanction_days = ?, admin_note = ?
         WHERE id = ?`,
        [adminId, reviewerSanction, days, admin_note || null, reportId],
      );
    } else {
      await conn.rollback();
      return res
        .status(400)
        .json({ error: "Укажите действие: accept или dismiss" });
    }

    await conn.commit();
    if (action === "dismiss") {
      await notificationModel.create({
        user_id: row.reporter_id,
        type: "review_report",
        title: `Жалоба #${reportId} отклонена`,
        body: admin_note || "Мы рассмотрели жалобу и не нашли нарушений.",
        entity_type: "review_report",
        entity_id: reportId,
      });
    } else {
      await notificationModel.create({
        user_id: row.reporter_id,
        type: "review_report",
        title: `Жалоба #${reportId} рассмотрена`,
        body: "Спасибо за обращение. Жалоба подтверждена, к нарушителю применены меры.",
        entity_type: "review_report",
        entity_id: reportId,
      });
      await notificationModel.create({
        user_id: row.review_author_id,
        type:
          sanction === "account_block" ? "account_blocked" : "review_report",
        title:
          sanction === "account_block"
            ? "Аккаунт заблокирован"
            : "Ограничение на отзывы",
        body:
          admin_note ||
          `По жалобе на отзыв к товару "${row.product_name}" применены ограничения. Вы можете подать апелляцию в профиле.`,
        entity_type: "review_report",
        entity_id: reportId,
      });
    }
    res.json({ ok: true });
  } catch (e) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        /* */
      }
    }
    next(e);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch {
        /* */
      }
    }
  }
}

module.exports = { list, approve, reject, remove, listReports, resolveReport };
