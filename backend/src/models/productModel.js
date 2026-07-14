const { pool } = require("../config/database");

const ALLOWED_SORT = ["name", "price", "created_at", "stock", "id"];
const ALLOWED_ORDER = ["asc", "desc"];
const SPEC_LIMIT = 80;

function normalizeSpec(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSpecs(description) {
  const text = String(description || "");
  const markerIndex = text.toLowerCase().indexOf("характеристики:");
  const source = markerIndex >= 0 ? text.slice(markerIndex) : text;
  const specs = [];
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*[-•]\s*(.+?)\s*$/);
    if (!match) continue;
    const spec = normalizeSpec(match[1]);
    if (spec && spec.length <= 120) specs.push(spec);
  }
  return specs;
}

function getSpecGroup(value) {
  const spec = String(value || "").toLowerCase();
  const named = spec.match(/^([^:]{2,50}):\s*(.+)$/);
  if (named)
    return named[1].trim().replace(/^./, (letter) => letter.toUpperCase());
  if (/\bвт\b/.test(spec)) return "Мощность";
  if (/\bнм\b/.test(spec)) return "Крутящий момент";
  if (/\bоб\/мин\b/.test(spec)) return "Частота вращения";
  if (/\bкг\b/.test(spec))
    return /грузопод/.test(spec) ? "Грузоподъёмность" : "Вес";
  if (/\bа\b/.test(spec) && /\d/.test(spec)) return "Сила тока";
  if (/\bв\b/.test(spec) && /\d/.test(spec)) return "Напряжение";
  if (/скорост/.test(spec)) return "Количество скоростей";
  if (/точност/.test(spec)) return "Точность";
  if (/дальност|\bм\b/.test(spec) && /\d/.test(spec))
    return "Дальность или длина";
  if (/мм/.test(spec))
    return /патрон/.test(spec)
      ? "Диаметр патрона"
      : /вил/.test(spec)
        ? "Длина вил"
        : "Размер";
  if (/положен/.test(spec)) return "Количество положений";
  if (/mma|tig|mig/.test(spec)) return "Технология сварки";
  return "Особенности";
}

function buildListQuery(filters) {
  const conditions = [];
  if (!filters.includeDeleted) {
    conditions.push("p.is_deleted = 0");
  }
  const params = [];

  if (filters.categorySlug) {
    conditions.push("c.slug = ?");
    params.push(filters.categorySlug);
  }
  if (filters.brandSlug) {
    conditions.push("b.slug = ?");
    params.push(filters.brandSlug);
  }
  if (filters.modelSlug) {
    conditions.push("bm.slug = ?");
    params.push(filters.modelSlug);
  }
  if (Array.isArray(filters.modelIds) && filters.modelIds.length > 0) {
    conditions.push(`bm.id IN (${filters.modelIds.map(() => "?").join(",")})`);
    params.push(...filters.modelIds);
  } else if (
    Array.isArray(filters.brandSlugs) &&
    filters.brandSlugs.length > 0
  ) {
    conditions.push(
      `b.slug IN (${filters.brandSlugs.map(() => "?").join(",")})`,
    );
    params.push(...filters.brandSlugs);
  }
  if (filters.minPrice !== undefined && filters.minPrice !== "") {
    conditions.push("p.price >= ?");
    params.push(Number(filters.minPrice));
  }
  if (filters.maxPrice !== undefined && filters.maxPrice !== "") {
    conditions.push("p.price <= ?");
    params.push(Number(filters.maxPrice));
  }
  if (filters.search) {
    conditions.push("(p.name LIKE ? OR p.description LIKE ?)");
    const q = `%${filters.search}%`;
    params.push(q, q);
  }
  if (filters.attributes && typeof filters.attributes === "object") {
    for (const valueIds of Object.values(filters.attributes)) {
      const ids = Array.isArray(valueIds)
        ? valueIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
        : [];

      if (ids.length === 0) {
        continue;
      }

      conditions.push(
        `EXISTS (
          SELECT 1
          FROM product_characteristic_values selected_pcv
          WHERE selected_pcv.product_id = p.id
            AND selected_pcv.value_id IN (${ids.map(() => "?").join(",")})
        )`,
      );
      params.push(...ids);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

async function countList(filters) {
  const { where, params } = buildListQuery(filters);
  const [[{ c }]] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN brand_models bm ON bm.id = p.brand_model_id
     LEFT JOIN brands b ON b.id = bm.brand_id
     ${where}`,
    params,
  );
  return c;
}

async function listPublic(
  filters,
  { page = 1, limit = 12, sort = "name", order = "asc" } = {},
) {
  const { where, params } = buildListQuery(filters);
  const offset = (Number(page) - 1) * Number(limit);
  const lim = Number(limit);
  const sortField = ALLOWED_SORT.includes(sort) ? sort : "name";
  const sortOrder = ALLOWED_ORDER.includes(order) ? order.toUpperCase() : "ASC";

  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.slug, p.price, p.image_path, p.stock, p.category_id, p.brand_model_id,
            p.created_at, c.name AS category_name, c.slug AS category_slug,
            b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug,
            bm.name AS model_name, bm.slug AS model_slug
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN brand_models bm ON bm.id = p.brand_model_id
     LEFT JOIN brands b ON b.id = bm.brand_id
     ${where}
     ORDER BY p.${sortField} ${sortOrder}
     LIMIT ? OFFSET ?`,
    [...params, lim, offset],
  );
  return rows;
}

async function listSpecFacets(filters = {}) {
  const facetFilters = { ...filters, specs: [] };
  const { where, params } = buildListQuery(facetFilters);
  const [rows] = await pool.query(
    `SELECT p.description
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN brand_models bm ON bm.id = p.brand_model_id
     LEFT JOIN brands b ON b.id = bm.brand_id
     ${where}
     LIMIT 1000`,
    params,
  );
  const counts = new Map();
  for (const row of rows) {
    for (const spec of extractSpecs(row.description)) {
      counts.set(spec, (counts.get(spec) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, group: getSpecGroup(value) }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "ru"))
    .slice(0, SPEC_LIMIT);
}

async function listCharacteristicFacets(filters = {}) {
  const [characteristics] = await pool.query(
    `SELECT id, name, slug
     FROM characteristics
     ORDER BY sort_order, name`,
  );

  const facets = [];

  for (const characteristic of characteristics) {
    const attributes = { ...(filters.attributes || {}) };
    delete attributes[characteristic.id];

    const facetFilters = {
      ...filters,
      attributes,
    };
    const { where, params } = buildListQuery(facetFilters);

    const [values] = await pool.query(
      `SELECT cv.id,
              cv.value,
              COUNT(DISTINCT p.id) AS count
       FROM characteristic_values cv
       JOIN product_characteristic_values pcv ON pcv.value_id = cv.id
       JOIN products p ON p.id = pcv.product_id
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN brand_models bm ON bm.id = p.brand_model_id
       LEFT JOIN brands b ON b.id = bm.brand_id
       ${where}
         ${where ? "AND" : "WHERE"} cv.characteristic_id = ?
       GROUP BY cv.id, cv.value, cv.sort_order
       HAVING count > 0
       ORDER BY cv.sort_order, cv.value`,
      [...params, characteristic.id],
    );

    if (values.length > 0) {
      facets.push({
        id: characteristic.id,
        name: characteristic.name,
        slug: characteristic.slug,
        values: values.map((value) => ({
          id: value.id,
          value: value.value,
          count: Number(value.count),
        })),
      });
    }
  }

  return facets;
}

async function getBySlug(slug) {
  const [rows] = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug,
            bm.name AS model_name, bm.slug AS model_slug
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN brand_models bm ON bm.id = p.brand_model_id
     LEFT JOIN brands b ON b.id = bm.brand_id
     WHERE p.slug = ? AND p.is_deleted = 0
     LIMIT 1`,
    [slug],
  );
  const product = rows[0] || null;

  if (!product) {
    return null;
  }

  const [characteristics] = await pool.query(
    `SELECT c.id AS characteristic_id,
            c.name AS characteristic_name,
            cv.id AS value_id,
            cv.value
     FROM product_characteristic_values pcv
     JOIN characteristic_values cv ON cv.id = pcv.value_id
     JOIN characteristics c ON c.id = cv.characteristic_id
     WHERE pcv.product_id = ?
     ORDER BY c.sort_order, c.name, cv.sort_order, cv.value`,
    [product.id],
  );

  return {
    ...product,
    characteristics,
  };
}

async function getById(id) {
  const [rows] = await pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug,
            bm.name AS model_name, bm.slug AS model_slug
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN brand_models bm ON bm.id = p.brand_model_id
     LEFT JOIN brands b ON b.id = bm.brand_id
     WHERE p.id = ?`,
    [id],
  );
  return rows[0] || null;
}

async function getStock(id) {
  const [[row]] = await pool.query(
    "SELECT stock FROM products WHERE id = ? AND is_deleted = 0 LIMIT 1",
    [id],
  );
  return row ? row.stock : null;
}

async function slugExists(slug, excludeId) {
  const sql = excludeId
    ? "SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1"
    : "SELECT id FROM products WHERE slug = ? LIMIT 1";
  const params = excludeId ? [slug, excludeId] : [slug];
  const [rows] = await pool.query(sql, params);
  return !!rows[0];
}

async function create(data) {
  const [res] = await pool.query(
    `INSERT INTO products (category_id, brand_model_id, name, slug, description, price, image_path, stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.category_id,
      data.brand_model_id ?? null,
      data.name,
      data.slug,
      data.description ?? null,
      data.price,
      data.image_path ?? null,
      data.stock ?? 0,
    ],
  );
  return res.insertId;
}

async function update(id, data) {
  await pool.query(
    `UPDATE products SET
       category_id = ?, brand_model_id = ?, name = ?, slug = ?, description = ?, price = ?, image_path = ?, stock = ?
     WHERE id = ?`,
    [
      data.category_id,
      data.brand_model_id ?? null,
      data.name,
      data.slug,
      data.description ?? null,
      data.price,
      data.image_path ?? null,
      data.stock ?? 0,
      id,
    ],
  );
}

async function softDelete(id) {
  const [res] = await pool.query(
    "UPDATE products SET is_deleted = 1, deleted_at = NOW() WHERE id = ?",
    [id],
  );
  return res.affectedRows > 0;
}

async function remove(id) {
  const [[{ c }]] = await pool.query(
    "SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?",
    [id],
  );
  if (c > 0) {
    const ok = await softDelete(id);
    return { ok, soft: true };
  }
  const [res] = await pool.query("DELETE FROM products WHERE id = ?", [id]);
  return { ok: res.affectedRows > 0, soft: false };
}

async function getPricesForIds(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT id, name, slug, price, stock, is_deleted FROM products WHERE id IN (${placeholders})`,
    ids,
  );
  return rows;
}

async function getPopular(limit = 8) {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.slug, p.price, p.image_path, p.stock,
            COUNT(oi.id) AS order_count
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     WHERE p.is_deleted = 0
     GROUP BY p.id
     ORDER BY order_count DESC, p.created_at DESC
     LIMIT ?`,
    [limit],
  );
  return rows;
}

async function getByIds(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.slug, p.price, p.image_path, p.stock,
            b.name AS brand_name, bm.name AS model_name
     FROM products p
     LEFT JOIN brand_models bm ON bm.id = p.brand_model_id
     LEFT JOIN brands b ON b.id = bm.brand_id
     WHERE p.id IN (${placeholders}) AND p.is_deleted = 0`,
    ids,
  );
  return rows;
}

module.exports = {
  listPublic,
  countList,
  getBySlug,
  getById,
  getStock,
  slugExists,
  create,
  update,
  remove,
  softDelete,
  getPricesForIds,
  getPopular,
  getByIds,
  listSpecFacets,
  listCharacteristicFacets,
  extractSpecs,
};
