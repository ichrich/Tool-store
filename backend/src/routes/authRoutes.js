const { Router } = require("express");
const { body } = require("express-validator");
const authController = require("../controllers/authController");
const { handleValidationErrors } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");

const router = Router();

router.post(
  "/login",
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Укажите корректный email"),
  body("password")
    .isString()
    .trim()
    .notEmpty()
    .isLength({ max: 200 })
    .withMessage("Введите пароль"),
  handleValidationErrors,
  authController.login,
);

router.post(
  "/register",
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Укажите корректный email"),
  body("password")
    .isLength({ min: 8, max: 200 })
    .withMessage("Пароль должен содержать минимум 8 символов")
    .matches(/[A-Za-z]/)
    .withMessage("Пароль должен содержать хотя бы одну букву"),
  body("first_name")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Имя не более 100 символов"),
  body("last_name")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Фамилия не более 100 символов"),
  body("phone")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[\d\+\-\(\)\s]{6,20}$/)
    .withMessage("Некорректный формат телефона"),
  handleValidationErrors,
  authController.register,
);

router.post(
  "/blocked-appeal",
  body("appeal_token").isString().notEmpty(),
  body("message").trim().notEmpty().isLength({ max: 5000 }),
  handleValidationErrors,
  authController.createBlockedAppeal,
);

router.get("/me", requireAuth, authController.getMe);

router.get("/vk/link-code", requireAuth, authController.createVkLinkCode);
router.delete("/vk/link", requireAuth, authController.unlinkVk);

router.put(
  "/me",
  requireAuth,
  body("email")
    .optional({ checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage("Некорректный email"),
  body("first_name")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 }),
  body("last_name")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 1, max: 100 }),
  body("phone")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[\d\+\-\(\)\s]{6,20}$/)
    .withMessage("Некорректный телефон"),
  body("current_password")
    .optional({ checkFalsy: true })
    .isString()
    .isLength({ min: 1, max: 200 }),
  body("password")
    .optional({ checkFalsy: true })
    .isLength({ min: 8, max: 200 })
    .withMessage("Пароль должен содержать минимум 8 символов"),
  handleValidationErrors,
  authController.updateProfile,
);

module.exports = router;
