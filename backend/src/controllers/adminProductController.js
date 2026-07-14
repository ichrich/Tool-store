const path = require("path");
const fs = require("fs");
const productModel = require("../models/productModel");
const categoryModel = require("../models/categoryModel");
const brandModel = require("../models/brandModel");
const characteristicModel = require("../models/characteristicModel");
const { slugFromTitle } = require("../utils/slug");
const { ensureUniqueSlug } = require("../utils/uniqueSlug");
const { uploadDir } = require("../middleware/upload");

function imagePathFromFile(file) {
  if (!file) return null;
  return `/uploads/${file.filename}`;
}

function maybeUnlink(imagePath) {
  if (!imagePath || !String(imagePath).startsWith("/uploads/")) return;
  const name = path.basename(imagePath);
  const full = path.join(uploadDir, name);
  if (fs.existsSync(full)) {
    fs.unlinkSync(full);
  }
}

function parseCharacteristics(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const error = new Error("Некорректный формат характеристик");
    error.status = 400;
    throw error;
  }
}

function hasCharacteristics(body) {
  return Object.prototype.hasOwnProperty.call(body, "characteristics");
}

async function resolveBrandModelId(body) {
  const brandId = body.brand_id ? Number(body.brand_id) : null;
  const modelId = body.brand_model_id ? Number(body.brand_model_id) : null;
  const modelName = String(body.model_name || "").trim();

  if (modelId) {
    const model = await brandModel.getModelById(modelId);
    if (!model) {
      const err = new Error("Модель бренда не найдена");
      err.status = 400;
      throw err;
    }
    if (brandId && Number(model.brand_id) !== brandId) {
      const err = new Error(
        "Выбранная модель не относится к выбранному бренду",
      );
      err.status = 400;
      throw err;
    }
    return modelId;
  }

  if (brandId && modelName) {
    return brandModel.createModel(brandId, modelName, slugFromTitle(modelName));
  }

  return null;
}

async function list(req, res, next) {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 50;
    const sort = req.query.sort || "id";
    const order = req.query.order || "desc";
    const filters = { includeDeleted: true, search: req.query.search || "" };
    const [items, total] = await Promise.all([
      productModel.listPublic(filters, { page, limit, sort, order }),
      productModel.countList(filters),
    ]);
    res.json({ items, page: Number(page), limit: Number(limit), total });
  } catch (e) {
    next(e);
  }
}

async function getOne(req, res, next) {
  try {
    const row = await productModel.getById(Number(req.params.id));
    if (!row) {
      return res.status(404).json({ error: "Товар не найден" });
    }
    const characteristicRows = await characteristicModel.getProductValues(
      row.id,
    );
    res.json({ ...row, characteristics: characteristicRows });
  } catch (e) {
    next(e);
  }
}

async function create(req, res, next) {
  try {
    const category = await categoryModel.getById(Number(req.body.category_id));
    if (!category) {
      return res.status(400).json({ error: "Категория не найдена" });
    }
    const brandModelId = await resolveBrandModelId(req.body);
    if (brandModelId && !(await brandModel.getModelById(brandModelId))) {
      return res.status(400).json({ error: "Модель бренда не найдена" });
    }
    const name = req.body.name;
    let slug = slugFromTitle(name, req.body.slug);
    slug = await ensureUniqueSlug(slug, (s) => productModel.slugExists(s));
    const image_path =
      imagePathFromFile(req.file) ?? (req.body.image_path || null);
    const id = await productModel.create({
      category_id: Number(req.body.category_id),
      brand_model_id: brandModelId,
      name,
      slug,
      description: req.body.description,
      price: Number(req.body.price),
      image_path,
      stock: req.body.stock !== undefined ? Number(req.body.stock) : 0,
    });
    if (hasCharacteristics(req.body)) {
      await characteristicModel.saveProductValues(
        id,
        parseCharacteristics(req.body.characteristics),
      );
    }
    res.status(201).json({ id, slug });
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await productModel.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Товар не найден" });
    }
    const category = await categoryModel.getById(Number(req.body.category_id));
    if (!category) {
      return res.status(400).json({ error: "Категория не найдена" });
    }
    const brandModelId = await resolveBrandModelId(req.body);
    if (brandModelId && !(await brandModel.getModelById(brandModelId))) {
      return res.status(400).json({ error: "Модель бренда не найдена" });
    }
    const name = req.body.name;
    let slug = slugFromTitle(name, req.body.slug);
    const clash = await productModel.slugExists(slug, id);
    if (clash) {
      slug = await ensureUniqueSlug(slug, (s) =>
        productModel.slugExists(s, id),
      );
    }
    let image_path = existing.image_path;
    if (req.file) {
      if (existing.image_path) {
        maybeUnlink(existing.image_path);
      }
      image_path = imagePathFromFile(req.file);
    } else if (req.body.image_path !== undefined) {
      image_path = req.body.image_path || null;
    }
    await productModel.update(id, {
      category_id: Number(req.body.category_id),
      brand_model_id: brandModelId,
      name,
      slug,
      description: req.body.description,
      price: Number(req.body.price),
      image_path,
      stock: req.body.stock !== undefined ? Number(req.body.stock) : 0,
    });
    if (hasCharacteristics(req.body)) {
      await characteristicModel.saveProductValues(
        id,
        parseCharacteristics(req.body.characteristics),
      );
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await productModel.getById(id);
    if (!existing) {
      return res.status(404).json({ error: "Товар не найден" });
    }
    const result = await productModel.remove(id);
    if (!result.ok) {
      return res.status(400).json({ error: "Не удалось удалить товар" });
    }
    if (!result.soft && existing.image_path) {
      maybeUnlink(existing.image_path);
    }
    res.json({ ok: true, soft: result.soft });
  } catch (e) {
    next(e);
  }
}

module.exports = { list, getOne, create, update, remove };
