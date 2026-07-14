const categoryModel = require("../models/categoryModel");
const { slugFromTitle } = require("../utils/slug");
const { ensureUniqueSlug } = require("../utils/uniqueSlug");

async function list(req, res, next) {
  try {
    res.json(await categoryModel.listAll());
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    const { name, slug: slugInput, recommended_category_ids } = req.body;
    let slug = slugFromTitle(name, slugInput);
    slug = await ensureUniqueSlug(slug, async (s) => {
      const existing = await categoryModel.getBySlug(s);
      return !!existing;
    });
    const id = await categoryModel.create({ name, slug });
    await categoryModel.setRecommendations(id, recommended_category_ids || []);
    res.status(201).json({ id, slug });
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await categoryModel.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Категория не найдена" });
    }
    const { name, slug: slugInput, recommended_category_ids } = req.body;
    let slug = slugFromTitle(name, slugInput);
    const other = await categoryModel.getBySlug(slug);
    if (other && other.id !== id) {
      slug = await ensureUniqueSlug(slug, async (s) => {
        const row = await categoryModel.getBySlug(s);
        return !!row && row.id !== id;
      });
    }
    await categoryModel.update(id, { name, slug });
    await categoryModel.setRecommendations(id, recommended_category_ids || []);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const n = await categoryModel.countProducts(id);
    if (n > 0) {
      return res.status(400).json({
        error: `Нельзя удалить категорию: в ней ${n} товар(ов). Сначала переместите или удалите товары из этой категории.`,
      });
    }
    const ok = await categoryModel.remove(id);
    if (!ok) {
      return res.status(404).json({ error: "Категория не найдена" });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, create, update, remove };
