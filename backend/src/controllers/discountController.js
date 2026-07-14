const discountModel = require("../models/discountModel");

async function validate(req, res, next) {
  try {
    const { code, cart_total, items } = req.body;
    const userId = req.user?.sub || null;
    const disc = await discountModel.findValidCode(
      code,
      Number(cart_total),
      userId,
      items,
    );
    if (!disc) {
      return res.status(404).json({
        error: "Промокод недействителен или не применим к данному заказу",
      });
    }
    const applicableTotal = Number(disc.applicable_total ?? cart_total);
    const amount =
      disc.type === "percent"
        ? Math.round(((applicableTotal * disc.value) / 100) * 100) / 100
        : Math.min(applicableTotal, disc.value);
    res.json({
      valid: true,
      type: disc.type,
      value: disc.value,
      discount_amount: amount,
      message:
        disc.type === "percent"
          ? `Скидка ${disc.value}% применена`
          : `Скидка ${disc.value} ₽ применена`,
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { validate };
