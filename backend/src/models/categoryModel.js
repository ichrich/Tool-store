const { pool } = require("../config/database");

async function listAll() {
  const [rows] = await pool.query(
    "SELECT id, name, slug, created_at, updated_at FROM categories ORDER BY name ASC",
  );
  return attachRecommendations(rows);
}

async function getById(id) {
  const [rows] = await pool.query("SELECT * FROM categories WHERE id = ?", [
    id,
  ]);
  const category = rows[0] || null;
  if (!category) return null;
  const [recommended] = await pool.query(
    `SELECT rc.id, rc.name, rc.slug
     FROM category_recommendations cr
     JOIN categories rc ON rc.id = cr.recommended_category_id
     WHERE cr.category_id = ?
     ORDER BY rc.name ASC`,
    [id],
  );
  category.recommended_categories = recommended;
  return category;
}

async function getBySlug(slug) {
  const [rows] = await pool.query("SELECT * FROM categories WHERE slug = ?", [
    slug,
  ]);
  return rows[0] || null;
}

async function create({ name, slug }) {
  const [res] = await pool.query(
    "INSERT INTO categories (name, slug) VALUES (?, ?)",
    [name, slug],
  );
  return res.insertId;
}

async function update(id, { name, slug }) {
  await pool.query("UPDATE categories SET name = ?, slug = ? WHERE id = ?", [
    name,
    slug,
    id,
  ]);
}

async function attachRecommendations(categories) {
  if (!categories.length) return categories;
  const ids = categories.map((c) => c.id);
  const placeholders = ids.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT cr.category_id, rc.id, rc.name, rc.slug
     FROM category_recommendations cr
     JOIN categories rc ON rc.id = cr.recommended_category_id
     WHERE cr.category_id IN (${placeholders})
     ORDER BY rc.name ASC`,
    ids,
  );
  const grouped = rows.reduce((acc, row) => {
    if (!acc[row.category_id]) acc[row.category_id] = [];
    acc[row.category_id].push({ id: row.id, name: row.name, slug: row.slug });
    return acc;
  }, {});
  return categories.map((c) => ({
    ...c,
    recommended_categories: grouped[c.id] || [],
  }));
}

async function setRecommendations(categoryId, recommendedIds = []) {
  const uniqueIds = [...new Set(recommendedIds.map(Number))].filter(
    (id) => Number.isInteger(id) && id > 0 && id !== Number(categoryId),
  );

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "DELETE FROM category_recommendations WHERE category_id = ?",
      [categoryId],
    );
    if (uniqueIds.length) {
      const [existing] = await conn.query(
        `SELECT id FROM categories WHERE id IN (${uniqueIds.map(() => "?").join(",")})`,
        uniqueIds,
      );
      const existingIds = existing.map((row) => row.id);
      if (existingIds.length) {
        await conn.query(
          `INSERT INTO category_recommendations (category_id, recommended_category_id)
           VALUES ${existingIds.map(() => "(?, ?)").join(", ")}`,
          existingIds.flatMap((id) => [categoryId, id]),
        );
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function countProducts(categoryId) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS c FROM products WHERE category_id = ? AND is_deleted = 0",
    [categoryId],
  );
  return rows[0].c;
}

async function remove(id) {
  const [res] = await pool.query("DELETE FROM categories WHERE id = ?", [id]);
  return res.affectedRows > 0;
}

async function getRecommendedProducts(categorySlug, limit = 8) {
  const [rows] = await pool.query(
    `SELECT p.id, p.name, p.slug, p.price, p.image_path, p.stock, p.category_id,
            rc.name AS category_name, rc.slug AS category_slug,
            b.name AS brand_name, bm.name AS model_name
     FROM categories c
     JOIN category_recommendations cr ON cr.category_id = c.id
     JOIN categories rc ON rc.id = cr.recommended_category_id
     JOIN products p ON p.category_id = rc.id AND p.is_deleted = 0
     LEFT JOIN brand_models bm ON bm.id = p.brand_model_id
     LEFT JOIN brands b ON b.id = bm.brand_id
     WHERE c.slug = ?
     ORDER BY p.stock > 0 DESC, p.created_at DESC
     LIMIT ?`,
    [categorySlug, Number(limit)],
  );
  return rows;
}

module.exports = {
  listAll,
  getById,
  getBySlug,
  create,
  update,
  setRecommendations,
  countProducts,
  remove,
  getRecommendedProducts,
};
