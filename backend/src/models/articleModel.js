const { pool } = require("../config/database");

async function listPublic() {
  const [rows] = await pool.query(
    `SELECT a.id, a.title, a.slug, a.author_name, a.created_at, a.updated_at,
            (SELECT ab.body FROM article_blocks ab WHERE ab.article_id = a.id AND ab.block_type = 'image' ORDER BY ab.sort_order, ab.id LIMIT 1) AS cover_image,
            (SELECT LEFT(ab.body, 240) FROM article_blocks ab WHERE ab.article_id = a.id AND ab.block_type = 'text' ORDER BY ab.sort_order, ab.id LIMIT 1) AS excerpt,
            u.id AS author_user_id, u.email AS author_email, u.first_name AS author_first_name, u.last_name AS author_last_name
     FROM articles a
     LEFT JOIN users u ON u.id = a.author_user_id
     WHERE a.published = 1
     ORDER BY a.created_at DESC`,
  );
  return rows;
}

async function listAdmin() {
  const [rows] = await pool.query(
    `SELECT a.id, a.title, a.slug, a.author_name, a.published, a.created_at, a.updated_at,
            u.email AS author_email
     FROM articles a
     LEFT JOIN users u ON u.id = a.author_user_id
     ORDER BY a.updated_at DESC`,
  );
  return rows;
}

async function getBySlugPublic(slug) {
  const [articles] = await pool.query(
    "SELECT * FROM articles WHERE slug = ? AND published = 1 LIMIT 1",
    [slug],
  );
  const article = articles[0];
  if (!article) return null;
  const [blocks] = await pool.query(
    `SELECT ab.id, ab.block_type, ab.body, ab.sort_order,
            ab.product_id, p.slug AS product_slug, p.name AS product_name, p.price AS product_price, p.image_path AS product_image
     FROM article_blocks ab
     LEFT JOIN products p ON p.id = ab.product_id AND ab.block_type = 'product'
     WHERE ab.article_id = ?
     ORDER BY ab.sort_order ASC, ab.id ASC`,
    [article.id],
  );
  return { ...article, blocks };
}

async function getByIdAdmin(id) {
  const [articles] = await pool.query("SELECT * FROM articles WHERE id = ?", [
    id,
  ]);
  const article = articles[0];
  if (!article) return null;
  const [blocks] = await pool.query(
    `SELECT ab.id, ab.block_type, ab.body, ab.sort_order,
            ab.product_id, p.slug AS product_slug, p.name AS product_name, p.price AS product_price, p.image_path AS product_image
     FROM article_blocks ab
     LEFT JOIN products p ON p.id = ab.product_id AND ab.block_type = 'product'
     WHERE ab.article_id = ?
     ORDER BY ab.sort_order ASC, ab.id ASC`,
    [id],
  );
  return { ...article, blocks };
}

async function slugExists(slug, excludeId) {
  const sql = excludeId
    ? "SELECT id FROM articles WHERE slug = ? AND id <> ? LIMIT 1"
    : "SELECT id FROM articles WHERE slug = ? LIMIT 1";
  const params = excludeId ? [slug, excludeId] : [slug];
  const [rows] = await pool.query(sql, params);
  return !!rows[0];
}

async function createWithBlocks(
  { title, slug, published, author_user_id = null, author_name = null },
  blocks,
) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.query(
      "INSERT INTO articles (author_user_id, author_name, title, slug, published) VALUES (?, ?, ?, ?, ?)",
      [author_user_id, author_name, title, slug, published ? 1 : 0],
    );
    const articleId = res.insertId;
    let order = 0;
    for (const b of blocks) {
      await conn.query(
        "INSERT INTO article_blocks (article_id, product_id, block_type, body, sort_order) VALUES (?, ?, ?, ?, ?)",
        [
          articleId,
          b.product_id ?? null,
          b.block_type,
          b.body ?? null,
          order++,
        ],
      );
    }
    await conn.commit();
    return articleId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function updateWithBlocks(
  id,
  { title, slug, published, author_user_id = null, author_name = null },
  blocks,
) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      "UPDATE articles SET author_user_id = ?, author_name = ?, title = ?, slug = ?, published = ? WHERE id = ?",
      [author_user_id, author_name, title, slug, published ? 1 : 0, id],
    );
    await conn.query("DELETE FROM article_blocks WHERE article_id = ?", [id]);
    let order = 0;
    for (const b of blocks) {
      await conn.query(
        "INSERT INTO article_blocks (article_id, product_id, block_type, body, sort_order) VALUES (?, ?, ?, ?, ?)",
        [id, b.product_id ?? null, b.block_type, b.body ?? null, order++],
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function remove(id) {
  const [res] = await pool.query("DELETE FROM articles WHERE id = ?", [id]);
  return res.affectedRows > 0;
}

module.exports = {
  listPublic,
  listAdmin,
  getBySlugPublic,
  getByIdAdmin,
  slugExists,
  createWithBlocks,
  updateWithBlocks,
  remove,
};
