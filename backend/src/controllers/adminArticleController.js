const articleModel = require("../models/articleModel");
const { slugFromTitle } = require("../utils/slug");
const { ensureUniqueSlug } = require("../utils/uniqueSlug");

function normalizeBlocks(bodyBlocks) {
  let raw = bodyBlocks;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (b) =>
        b &&
        (b.block_type === "text" ||
          b.block_type === "image" ||
          b.block_type === "product"),
    )
    .map((b) => ({
      block_type: b.block_type,
      body:
        b.block_type === "product" ? "" : b.body != null ? String(b.body) : "",
      product_id:
        b.block_type === "product" ? Number(b.product_id || b.body) : null,
    }))
    .filter((b) => {
      if (b.block_type === "product") {
        return Number.isInteger(b.product_id) && b.product_id > 0;
      }
      return true;
    });
}

async function list(req, res, next) {
  try {
    res.json(await articleModel.listAdmin());
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await articleModel.getByIdAdmin(Number(req.params.id));
    if (!row) {
      return res.status(404).json({ error: "Статья не найдена" });
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    const title = req.body.title;
    let slug = slugFromTitle(title, req.body.slug);
    slug = await ensureUniqueSlug(slug, (s) => articleModel.slugExists(s));
    const published =
      req.body.published === true ||
      req.body.published === "true" ||
      req.body.published === 1;
    const author_name = String(req.body.author_name || "").trim() || null;
    const blocks = normalizeBlocks(req.body.blocks);
    if (blocks.length === 0) {
      return res.status(400).json({ error: "Добавьте хотя бы один блок" });
    }
    const id = await articleModel.createWithBlocks(
      {
        title,
        slug,
        published,
        author_user_id: Number(req.user.sub),
        author_name,
      },
      blocks,
    );
    res.status(201).json({ id, slug });
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await articleModel.getByIdAdmin(id);
    if (!existing) {
      return res.status(404).json({ error: "Статья не найдена" });
    }
    const title = req.body.title;
    let slug = slugFromTitle(title, req.body.slug);
    const clash = await articleModel.slugExists(slug, id);
    if (clash) {
      slug = await ensureUniqueSlug(slug, (s) =>
        articleModel.slugExists(s, id),
      );
    }
    const published =
      req.body.published === true ||
      req.body.published === "true" ||
      req.body.published === 1;
    const author_name = String(req.body.author_name || "").trim() || null;
    const blocks = normalizeBlocks(req.body.blocks);
    if (blocks.length === 0) {
      return res.status(400).json({ error: "Добавьте хотя бы один блок" });
    }
    await articleModel.updateWithBlocks(
      id,
      {
        title,
        slug,
        published,
        author_user_id: existing.author_user_id || Number(req.user.sub),
        author_name,
      },
      blocks,
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    const ok = await articleModel.remove(Number(req.params.id));
    if (!ok) {
      return res.status(404).json({ error: "Статья не найдена" });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, getOne, create, update, remove, normalizeBlocks };
