const discountModel = require("../models/discountModel");

async function list(req, res, next) {
  try {
    const items = await discountModel.list();
    res.json(items);
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    const id = await discountModel.create(req.body);
    res.status(201).json({ id });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Такой промокод уже существует" });
    }
    next(e);
  }
}

async function update(req, res, next) {
  try {
    await discountModel.update(Number(req.params.id), req.body);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Такой промокод уже существует" });
    }
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    await discountModel.remove(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, create, update, remove };
