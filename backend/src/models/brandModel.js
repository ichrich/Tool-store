const { pool } = require("../config/database");

async function listBrands() {
  const [rows] = await pool.query(
    `SELECT b.*,
            COUNT(DISTINCT bm.id) AS models_count,
            COUNT(DISTINCT p.id) AS products_count
     FROM brands b
     LEFT JOIN brand_models bm ON bm.brand_id = b.id
     LEFT JOIN products p ON p.brand_model_id = bm.id AND p.is_deleted = 0
     GROUP BY b.id
     ORDER BY b.name ASC`,
  );
  return rows;
}

async function listModels(brandId = null) {
  const params = [];
  const where = brandId ? "WHERE bm.brand_id = ?" : "";
  if (brandId) params.push(Number(brandId));
  const [rows] = await pool.query(
    `SELECT bm.*, b.name AS brand_name, b.slug AS brand_slug
     FROM brand_models bm
     JOIN brands b ON b.id = bm.brand_id
     ${where}
     ORDER BY b.name ASC, bm.name ASC`,
    params,
  );
  return rows;
}

async function getModelById(id) {
  const [[row]] = await pool.query(
    `SELECT bm.*, b.name AS brand_name, b.slug AS brand_slug
     FROM brand_models bm
     JOIN brands b ON b.id = bm.brand_id
     WHERE bm.id = ?
     LIMIT 1`,
    [id],
  );
  return row || null;
}

async function createModel(brandId, name, slug) {
  await pool.query(
    "INSERT IGNORE INTO brand_models (brand_id, name, slug) VALUES (?, ?, ?)",
    [brandId, name, slug],
  );
  const [[row]] = await pool.query(
    "SELECT id FROM brand_models WHERE brand_id = ? AND slug = ? LIMIT 1",
    [brandId, slug],
  );
  return row?.id || null;
}

module.exports = { listBrands, listModels, getModelById, createModel };
