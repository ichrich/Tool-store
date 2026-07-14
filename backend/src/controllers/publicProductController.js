const productModel = require("../models/productModel");
const brandModel = require("../models/brandModel");
const { pool } = require("../config/database");
const suspensionModel = require("../models/suspensionModel");
const reviewEligibilityModel = require("../models/reviewEligibilityModel");

function restrictionPayload(summary) {
  if (!summary || !summary.active) return null;
  return {
    active: true,
    permanent: summary.permanent,
    expires_at: summary.expires_at ? summary.expires_at.toISOString() : null,
    reasons: summary.reasons,
  };
}

function parseAttributeFilters(value) {
  const result = {};

  for (const group of String(value || "").split(";")) {
    const [characteristicIdRaw, valuesRaw] = group.split(":");
    const characteristicId = Number(characteristicIdRaw);

    if (
      !Number.isInteger(characteristicId) ||
      characteristicId < 1 ||
      !valuesRaw
    ) {
      continue;
    }

    const valueIds = valuesRaw
      .split(",")
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0)
      .slice(0, 50);

    if (valueIds.length > 0) {
      result[characteristicId] = [...new Set(valueIds)];
    }
  }

  return result;
}

async function list(req, res, next) {
  try {
    const {
      category: categorySlug,
      brand: brandSlug,
      model: modelSlug,
      brands,
      models,
      minPrice,
      maxPrice,
      search,
      attributes,
      page = 1,
      limit = 12,
      sort = "name",
      order = "asc",
    } = req.query;

    const brandSlugs = String(brands || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const modelIds = String(models || "")
      .split(",")
      .map((x) => Number(x))
      .filter((x) => Number.isInteger(x) && x > 0);
    const selectedAttributes = parseAttributeFilters(attributes);
    const filters = {
      categorySlug,
      brandSlug,
      modelSlug,
      brandSlugs,
      modelIds,
      attributes: selectedAttributes,
      minPrice,
      maxPrice,
      search,
    };
    const [items, total, characteristicFacets] = await Promise.all([
      productModel.listPublic(filters, { page, limit, sort, order }),
      productModel.countList(filters),
      productModel.listCharacteristicFacets(filters),
    ]);

    // Сессия просмотра нужна для рекомендаций.
    const sessionId = req.headers["x-session-id"] || null;
    const userId = req.user?.sub || null;

    res.json({
      items,
      page: Number(page),
      limit: Number(limit),
      total,
      sort,
      order,
      characteristics: characteristicFacets,
    });
  } catch (e) {
    next(e);
  }
}

async function brands(req, res, next) {
  try {
    const [brandsRows, modelsRows] = await Promise.all([
      brandModel.listBrands(),
      brandModel.listModels(req.query.brand_id || null),
    ]);
    res.json({ brands: brandsRows, models: modelsRows });
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await productModel.getBySlug(req.params.slug);
    if (!row) {
      return res.status(404).json({ error: "Товар не найден" });
    }

    // Учитываем просмотр товара.
    try {
      const userId = req.user?.sub || null;
      const sessionId = req.headers["x-session-id"] || null;
      if (userId || sessionId) {
        await pool.query(
          "INSERT INTO view_history (user_id, session_id, product_id) VALUES (?, ?, ?)",
          [userId, sessionId, row.id],
        );
      }
    } catch {
      // Ошибка учёта просмотра не должна мешать открытию товара.
    }

    let can_review = false;
    let review_quota = null;
    let review_restriction = null;
    if (req.user?.sub) {
      const uid = Number(req.user.sub);
      const summary = await suspensionModel.getReviewRestrictionSummary(uid);
      review_restriction = restrictionPayload(summary);
      const purchased = await reviewEligibilityModel.getPurchasedUnits(
        uid,
        row.id,
      );
      const written = await reviewEligibilityModel.getUserReviewCount(
        uid,
        row.id,
      );
      can_review = !summary.active && purchased > written;
      review_quota = {
        purchased_units: purchased,
        reviews_written: written,
        remaining: Math.max(0, purchased - written),
      };
    }

    res.json({ ...row, can_review, review_quota, review_restriction });
  } catch (e) {
    next(e);
  }
}

async function getStock(req, res, next) {
  try {
    const id = Number(req.params.id);
    const stock = await productModel.getStock(id);
    if (stock === null)
      return res.status(404).json({ error: "Товар не найден" });
    res.json({ stock });
  } catch (e) {
    next(e);
  }
}

async function recommendations(req, res, next) {
  try {
    const userId = req.user?.sub || null;
    const sessionId = req.headers["x-session-id"] || null;
    const limit = 8;

    if (userId) {
      const [history] = await pool.query(
        `SELECT DISTINCT product_id FROM view_history WHERE user_id = ?
         ORDER BY viewed_at DESC LIMIT 20`,
        [userId],
      );
      const viewedIds = [...new Set(history.map((r) => r.product_id))];

      if (viewedIds.length > 0) {
        const ph = viewedIds.map(() => "?").join(",");
        const [rows] = await pool.query(
          `SELECT DISTINCT p.id, p.name, p.slug, p.price, p.image_path, p.stock
           FROM products p
           WHERE p.category_id IN (
             SELECT DISTINCT category_id FROM products WHERE id IN (${ph})
           )
           AND p.id NOT IN (${ph})
           AND p.is_deleted = 0
           ORDER BY p.stock > 0 DESC, RAND()
           LIMIT ?`,
          [...viewedIds, ...viewedIds, limit],
        );
        if (rows.length >= 4)
          return res.json({ type: "personal", items: rows });
      }
    }

    // Если персональных данных мало, показываем популярные товары.
    const popular = await productModel.getPopular(limit);
    res.json({ type: "popular", items: popular });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, getOne, getStock, recommendations, brands };
