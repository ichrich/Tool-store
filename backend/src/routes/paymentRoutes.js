const router = require("express").Router();

const {
  createPayment,
  checkPayment,
} = require("../controllers/paymentController");
const { optionalAuth } = require("../middleware/auth");

router.post("/create", optionalAuth, createPayment);

router.get("/status", optionalAuth, checkPayment);

module.exports = router;
