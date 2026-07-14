const { Router } = require("express");
const { body, param, query } = require("express-validator");
const { requireAdmin } = require("../middleware/auth");
const { handleValidationErrors } = require("../middleware/validate");
const { upload } = require("../middleware/upload");
const uploadController = require("../controllers/uploadController");
const adminCategoryController = require("../controllers/adminCategoryController");
const adminProductController = require("../controllers/adminProductController");
const adminCharacteristicController = require("../controllers/adminCharacteristicController");
const adminArticleController = require("../controllers/adminArticleController");
const adminOrderController = require("../controllers/adminOrderController");
const adminReviewController = require("../controllers/adminReviewController");
const adminDiscountController = require("../controllers/adminDiscountController");
const adminReportController = require("../controllers/adminReportController");
const adminUserController = require("../controllers/adminUserController");
const appealController = require("../controllers/appealController");
const brandModel = require("../models/brandModel");

const router = Router();

router.use(requireAdmin);

router.get("/characteristics", adminCharacteristicController.list);

const trimString = (field) =>
  body(field).trim().notEmpty().withMessage("Поле обязательно");
const optionalTrimmedString = (field, max) =>
  body(field)
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max })
    .withMessage(`Значение должно быть от 1 до ${max} символов`);

router.get("/brands", async (req, res, next) => {
  try {
    const [brands, models] = await Promise.all([
      brandModel.listBrands(),
      brandModel.listModels(req.query.brand_id || null),
    ]);
    res.json({ brands, models });
  } catch (e) {
    next(e);
  }
});

// Upload
router.post(
  "/upload",
  upload.single("file"),
  (err, req, res, next) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  },
  uploadController.uploadImage,
);

// Categories
router.get("/categories", adminCategoryController.list);
router.post(
  "/categories",
  trimString("name")
    .isLength({ max: 200 })
    .withMessage("Название не более 200 символов"),
  body("slug").optional({ checkFalsy: true }).trim().isLength({ max: 220 }),
  body("recommended_category_ids").optional().isArray(),
  body("recommended_category_ids.*").optional().isInt({ min: 1 }),
  handleValidationErrors,
  adminCategoryController.create,
);
router.put(
  "/categories/:id",
  param("id").isInt({ min: 1 }),
  trimString("name")
    .isLength({ max: 200 })
    .withMessage("Название не более 200 символов"),
  body("slug").optional({ checkFalsy: true }).trim().isLength({ max: 220 }),
  body("recommended_category_ids").optional().isArray(),
  body("recommended_category_ids.*").optional().isInt({ min: 1 }),
  handleValidationErrors,
  adminCategoryController.update,
);
router.delete(
  "/categories/:id",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminCategoryController.remove,
);

// Products
router.get(
  "/products",
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 200 }),
  query("sort").optional().isIn(["id", "name", "price", "created_at", "stock"]),
  query("order").optional().isIn(["asc", "desc"]),
  query("search").optional().isString(),
  handleValidationErrors,
  adminProductController.list,
);
router.get(
  "/products/:id",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminProductController.getOne,
);
router.post(
  "/products",
  upload.single("image"),
  trimString("name")
    .isLength({ max: 500 })
    .withMessage("Название не более 500 символов"),
  body("category_id").isInt({ min: 1 }).withMessage("Выберите категорию"),
  body("slug").optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
  body("description")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 10000 }),
  body("brand_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("brand_model_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("model_name")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 255 }),
  body("price")
    .isFloat({ gt: 0, max: 9999999999.99 })
    .withMessage("Цена должна быть больше 0"),
  body("stock")
    .optional()
    .isInt({ min: 0, max: 9999 })
    .withMessage("Остаток 0-9999"),
  body("characteristics")
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 50000 }),
  handleValidationErrors,
  adminProductController.create,
);
router.put(
  "/products/:id",
  param("id").isInt({ min: 1 }),
  upload.single("image"),
  trimString("name")
    .isLength({ max: 500 })
    .withMessage("Название не более 500 символов"),
  body("category_id").isInt({ min: 1 }).withMessage("Выберите категорию"),
  body("slug").optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
  body("description")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 10000 }),
  body("brand_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("brand_model_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("model_name")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 255 }),
  body("price")
    .isFloat({ gt: 0, max: 9999999999.99 })
    .withMessage("Цена должна быть больше 0"),
  body("stock")
    .optional()
    .isInt({ min: 0, max: 9999 })
    .withMessage("Остаток 0-9999"),
  body("characteristics")
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 50000 }),
  handleValidationErrors,
  adminProductController.update,
);
router.delete(
  "/products/:id",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminProductController.remove,
);

// Articles
router.get("/articles", adminArticleController.list);
router.get(
  "/articles/:id",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminArticleController.getOne,
);
router.post(
  "/articles",
  trimString("title")
    .isLength({ max: 500 })
    .withMessage("Заголовок не более 500 символов"),
  body("slug").optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
  optionalTrimmedString("author_name", 255),
  body("published").optional().isBoolean().toBoolean(),
  body("blocks").isArray({ min: 1 }).withMessage("Добавьте блоки статьи"),
  handleValidationErrors,
  adminArticleController.create,
);
router.put(
  "/articles/:id",
  param("id").isInt({ min: 1 }),
  trimString("title")
    .isLength({ max: 500 })
    .withMessage("Заголовок не более 500 символов"),
  body("slug").optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
  optionalTrimmedString("author_name", 255),
  body("published").optional().isBoolean().toBoolean(),
  body("blocks").isArray({ min: 1 }).withMessage("Добавьте блоки статьи"),
  handleValidationErrors,
  adminArticleController.update,
);
router.delete(
  "/articles/:id",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminArticleController.remove,
);

// Orders
router.get(
  "/orders",
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("status")
    .optional()
    .isIn(["new", "processing", "completed", "delivered", "cancelled"]),
  query("search").optional().isString(),
  query("sort")
    .optional()
    .isIn([
      "id",
      "created_at",
      "customer_name",
      "customer_email",
      "status",
      "total_amount",
      "items_count",
    ]),
  query("order").optional().isIn(["asc", "desc"]),
  handleValidationErrors,
  adminOrderController.list,
);
router.get(
  "/orders/:id",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminOrderController.getOne,
);
router.patch(
  "/orders/:id/status",
  param("id").isInt({ min: 1 }),
  body("status")
    .isIn(["new", "processing", "completed", "delivered", "cancelled"])
    .withMessage("Недопустимый статус"),
  handleValidationErrors,
  adminOrderController.updateStatus,
);
router.patch(
  "/orders/:id/admin-note",
  param("id").isInt({ min: 1 }),
  body("admin_note")
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 5000 }),
  handleValidationErrors,
  adminOrderController.updateAdminNote,
);

// Reviews moderation
router.get(
  "/reviews",
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("status").optional().isIn(["all", "pending", "approved", "rejected"]),
  query("search").optional().isString(),
  query("product_id").optional().isInt({ min: 1 }),
  query("sort")
    .optional()
    .isIn([
      "created_at",
      "id",
      "product_name",
      "user_email",
      "rating",
      "status",
    ]),
  query("order").optional().isIn(["asc", "desc"]),
  handleValidationErrors,
  adminReviewController.list,
);
router.patch(
  "/reviews/:id/approve",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminReviewController.approve,
);
router.patch(
  "/reviews/:id/reject",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminReviewController.reject,
);
router.delete(
  "/reviews/:id",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminReviewController.remove,
);
router.get(
  "/review-reports",
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("archive").optional().isIn(["true", "false", "0", "1"]),
  query("search").optional().isString(),
  query("sort").optional().isIn(["created_at", "id", "reason", "status"]),
  query("order").optional().isIn(["asc", "desc"]),
  handleValidationErrors,
  adminReviewController.listReports,
);
router.patch(
  "/review-reports/:id",
  param("id").isInt({ min: 1 }),
  body("action").isIn(["accept", "dismiss"]),
  body("sanction").optional().isIn(["review_ban_days", "account_block"]),
  body("sanction_days").optional().isInt({ min: 1, max: 3650 }),
  body("admin_note").optional().isString().isLength({ max: 500 }),
  body("delete_all_reviews").optional().isBoolean(),
  handleValidationErrors,
  adminReviewController.resolveReport,
);

// Users management
router.get(
  "/users",
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("search").optional().isString(),
  query("sort")
    .optional()
    .isIn(["id", "email", "created_at", "role", "is_active", "first_name"]),
  query("order").optional().isIn(["asc", "desc"]),
  handleValidationErrors,
  adminUserController.list,
);
router.get(
  "/users/:id/detail",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminUserController.detail,
);
router.patch(
  "/users/:id/block",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminUserController.block,
);
router.patch(
  "/users/:id/unblock",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminUserController.unblock,
);
router.post(
  "/users/:id/suspend-reviews",
  param("id").isInt({ min: 1 }),
  body("reason").trim().notEmpty().withMessage("Укажите причину"),
  body("expires_at").optional().isISO8601(),
  handleValidationErrors,
  adminUserController.suspendReviews,
);

router.get(
  "/appeals",
  query("status").optional().isIn(["all", "pending", "approved", "rejected"]),
  handleValidationErrors,
  appealController.listAdmin,
);
router.patch(
  "/appeals/:id",
  param("id")
    .matches(/^(unblock:|cancel:)?\d+$/)
    .withMessage("Некорректный номер заявки"),
  body("status").isIn(["approved", "rejected"]),
  body("admin_note")
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 5000 }),
  body("order").optional().isObject(),
  handleValidationErrors,
  appealController.resolve,
);

// Discounts
router.get("/discounts", adminDiscountController.list);
router.post(
  "/discounts",
  body("code")
    .trim()
    .notEmpty()
    .isLength({ max: 50 })
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Код может содержать латиницу, цифры, _ и -"),
  body("type").isIn(["percent", "fixed"]),
  body("value").custom((value, { req }) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0)
      throw new Error("Скидка должна быть больше 0");
    if (req.body.type === "percent" && number > 100)
      throw new Error("Процентная скидка не может быть больше 100%");
    if (req.body.type === "fixed" && number > 9999999999.99)
      throw new Error("Слишком большая скидка");
    return true;
  }),
  body("scope").optional().isIn(["global", "category", "product", "user"]),
  body("scope_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("product_ids").optional().isArray({ max: 500 }),
  body("product_ids.*").isInt({ min: 1 }),
  body("min_order_amount")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 9999999999.99 }),
  body("max_uses")
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 1000000 }),
  body("starts_at").optional({ checkFalsy: true }).isISO8601(),
  body("expires_at").optional({ checkFalsy: true }).isISO8601(),
  body("is_active").optional().isBoolean().toBoolean(),
  handleValidationErrors,
  adminDiscountController.create,
);
router.put(
  "/discounts/:id",
  param("id").isInt({ min: 1 }),
  body("code")
    .trim()
    .notEmpty()
    .isLength({ max: 50 })
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Код может содержать латиницу, цифры, _ и -"),
  body("type").isIn(["percent", "fixed"]),
  body("value").custom((value, { req }) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0)
      throw new Error("Скидка должна быть больше 0");
    if (req.body.type === "percent" && number > 100)
      throw new Error("Процентная скидка не может быть больше 100%");
    if (req.body.type === "fixed" && number > 9999999999.99)
      throw new Error("Слишком большая скидка");
    return true;
  }),
  body("scope").optional().isIn(["global", "category", "product", "user"]),
  body("scope_id").optional({ checkFalsy: true }).isInt({ min: 1 }),
  body("product_ids").optional().isArray({ max: 500 }),
  body("product_ids.*").isInt({ min: 1 }),
  body("min_order_amount")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 9999999999.99 }),
  body("max_uses")
    .optional({ checkFalsy: true })
    .isInt({ min: 1, max: 1000000 }),
  body("starts_at").optional({ checkFalsy: true }).isISO8601(),
  body("expires_at").optional({ checkFalsy: true }).isISO8601(),
  body("is_active").optional().isBoolean().toBoolean(),
  handleValidationErrors,
  adminDiscountController.update,
);
router.delete(
  "/discounts/:id",
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  adminDiscountController.remove,
);

// Reports
router.get("/reports/orders", adminReportController.ordersReport);
router.get("/reports/products", adminReportController.productsReport);
router.get("/reports/users", adminReportController.usersReport);

module.exports = router;
