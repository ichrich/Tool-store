const articleModel = require("../models/articleModel");

async function list(req, res, next) {
  try {
    const rows = await articleModel.listPublic();
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await articleModel.getBySlugPublic(req.params.slug);
    if (!row) {
      return res.status(404).json({ error: "Статья не найдена" });
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
}

module.exports = { list, getOne };
