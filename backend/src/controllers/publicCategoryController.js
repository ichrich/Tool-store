const categoryModel = require("../models/categoryModel");

async function list(req, res, next) {
  try {
    const rows = await categoryModel.listAll();
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function recommendedProducts(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 8), 1), 24);
    const rows = await categoryModel.getRecommendedProducts(
      req.params.slug,
      limit,
    );
    res.json({ items: rows, total: rows.length });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, recommendedProducts };
