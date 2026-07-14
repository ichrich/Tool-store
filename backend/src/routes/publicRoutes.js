const { Router } = require("express");
const { body, param, query } = require("express-validator");
const publicCategoryController = require("../controllers/publicCategoryController");
const publicProductController = require("../controllers/publicProductController");
const publicArticleController = require("../controllers/publicArticleController");
const orderController = require("../controllers/orderController");
const cartController = require("../controllers/cartController");
const reviewController = require("../controllers/reviewController");
const discountController = require("../controllers/discountController");
const { handleValidationErrors } = require("../middleware/validate");
const {
  requireAuth,
  requireAuthAllowBlocked,
  optionalAuth,
} = require("../middleware/auth");
const appealController = require("../controllers/appealController");
const notificationController = require("../controllers/notificationController");
const { upload } = require("../middleware/upload");

const router = Router();

function reviewImagesUpload(req, res, next) {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) {
    return upload.array("images", 3)(req, res, next);
  }
  return next();
}

// Categories
router.get("/categories", publicCategoryController.list);
router.get(
  "/categories/:slug/recommended-products",
  publicCategoryController.recommendedProducts,
);

// Products
router.get(
  "/products",
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("minPrice").optional().isFloat({ min: 0 }),
  query("maxPrice").optional().isFloat({ min: 0 }),
  query("brand").optional().isString(),
  query("model").optional().isString(),
  query("brands").optional().isString(),
  query("models").optional().isString(),
  query("attributes").optional().isString().isLength({ max: 4000 }),
  query("sort").optional().isIn(["name", "price", "created_at", "stock"]),
  query("order").optional().isIn(["asc", "desc"]),
  handleValidationErrors,
  optionalAuth,
  publicProductController.list,
);
router.get("/products/id/:id/stock", publicProductController.getStock);
router.get("/brands", publicProductController.brands);
// Важно: до /products/:slug, иначе «reviews» может перехватываться как slug в некоторых конфигурациях
router.get(
  "/products/:productId/reviews",
  param("productId").isInt({ min: 1 }),
  handleValidationErrors,
  reviewController.list,
);
router.post(
  "/products/:productId/reviews",
  requireAuth,
  reviewImagesUpload,
  param("productId").isInt({ min: 1 }),
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Оценка от 1 до 5"),
  body("body")
    .trim()
    .notEmpty()
    .withMessage("Текст отзыва обязателен")
    .isLength({ max: 3000 }),
  handleValidationErrors,
  reviewController.create,
);
router.get("/products/:slug", optionalAuth, publicProductController.getOne);
router.get(
  "/recommendations",
  optionalAuth,
  publicProductController.recommendations,
);

// Articles
router.get("/articles", publicArticleController.list);
router.get("/articles/:slug", publicArticleController.getOne);

// Orders
router.post(
  "/orders",
  requireAuth,
  body("customer_name")
    .trim()
    .notEmpty()
    .withMessage("Укажите имя")
    .isLength({ max: 200 }),
  body("customer_email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Укажите корректный email"),
  body("customer_phone")
    .trim()
    .notEmpty()
    .withMessage("Укажите телефон")
    .matches(/^[\d\+\-\(\)\s]{6,20}$/)
    .withMessage("Некорректный формат телефона"),
  body("customer_company")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 255 }),
  body("address")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 500 }),
  body("notes")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 2000 }),
  body("payment_method")
    .isIn(["cash", "yookassa"])
    .withMessage("Выберите способ оплаты"),
  body("delivery_time").optional({ checkFalsy: true }).isISO8601(),
  body("promo_code")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 50 })
    .matches(/^[A-Za-z0-9_-]+$/),
  body("items").isArray({ min: 1 }).withMessage("Добавьте позиции заказа"),
  body("items.*.product_id")
    .isInt({ min: 1 })
    .withMessage("Некорректный товар"),
  body("items.*.quantity")
    .isInt({ min: 1, max: 999 })
    .withMessage("Количество 1-999"),
  handleValidationErrors,
  orderController.create,
);

// Order history for auth users
router.get("/my-orders", requireAuth, orderController.myOrders);
router.get("/my-orders/:id", requireAuth, orderController.myOrderDetail);
router.patch(
  "/my-orders/:id/cancel",
  requireAuth,
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  orderController.cancelMyOrder,
);
router.post(
  "/my-orders/:id/cancel-request",
  requireAuth,
  param("id").isInt({ min: 1 }),
  body("reason")
    .optional({ checkFalsy: true })
    .isIn([
      "changed_mind",
      "wrong_contacts",
      "wrong_address",
      "duplicate",
      "too_long",
      "other",
    ]),
  body("comment")
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 1000 }),
  handleValidationErrors,
  orderController.requestCancelMyOrder,
);
router.patch(
  "/my-orders/:id/payment-demo",
  requireAuth,
  param("id").isInt({ min: 1 }),
  body("success")
    .custom((v) => v === true || v === false)
    .withMessage("Укажите success: true или false"),
  handleValidationErrors,
  orderController.simulatePayment,
);

// Cart (server-side for auth users)
router.get("/cart", requireAuth, cartController.get);
router.post(
  "/cart",
  requireAuth,
  body("product_id").isInt({ min: 1 }),
  body("quantity").isInt({ min: 1, max: 999 }),
  handleValidationErrors,
  cartController.upsert,
);
router.delete(
  "/cart/:productId",
  requireAuth,
  param("productId").isInt({ min: 1 }),
  handleValidationErrors,
  cartController.remove,
);
router.delete("/cart", requireAuth, cartController.clear);

router.get("/notifications", requireAuth, notificationController.list);
router.patch(
  "/notifications/:id/read",
  requireAuth,
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  notificationController.markRead,
);

router.get("/appeals/my", requireAuthAllowBlocked, appealController.myAppeals);
router.post(
  "/appeals",
  requireAuthAllowBlocked,
  upload.single("screenshot"),
  body("message").trim().notEmpty().isLength({ max: 5000 }),
  handleValidationErrors,
  appealController.create,
);

// Reviews (часть маршрутов объявлена выше, до /products/:slug)
router.put(
  "/reviews/:id",
  requireAuth,
  param("id").isInt({ min: 1 }),
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Оценка от 1 до 5"),
  body("body")
    .trim()
    .notEmpty()
    .withMessage("Текст отзыва обязателен")
    .isLength({ max: 3000 }),
  handleValidationErrors,
  reviewController.update,
);
router.delete(
  "/reviews/:id",
  requireAuth,
  param("id").isInt({ min: 1 }),
  handleValidationErrors,
  reviewController.remove,
);

// Report review
router.post(
  "/reviews/:id/report",
  requireAuth,
  param("id").isInt({ min: 1 }),
  body("reason").isIn(["spam", "insult", "fake", "other", "photo"]),
  body("comment")
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ max: 500 }),
  body("review_image_id").optional({ nullable: true }).isInt({ min: 1 }),
  handleValidationErrors,
  reviewController.report,
);

// Discounts - validate promo code
router.post(
  "/discounts/validate",
  optionalAuth,
  body("code")
    .trim()
    .notEmpty()
    .isLength({ max: 50 })
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage("Введите корректный промокод"),
  body("cart_total").isFloat({ min: 0, max: 9999999999.99 }),
  body("items").isArray({ min: 1, max: 200 }),
  body("items.*.product_id").isInt({ min: 1 }),
  body("items.*.quantity").isInt({ min: 1, max: 999 }),
  body("items.*.price").isFloat({ min: 0.01, max: 9999999999.99 }),
  handleValidationErrors,
  discountController.validate,
);

module.exports = router;
