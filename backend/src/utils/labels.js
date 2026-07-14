const ORDER_STATUS = {
  new: "Новый",
  processing: "В обработке",
  completed: "Выполнен",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

const PAYMENT_METHOD = {
  cash: "Наличными при получении",
  yookassa: "ЮKassa",
};

const PAYMENT_STATUS = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  failed: "Ошибка оплаты",
};

const REVIEW_REPORT_REASON = {
  spam: "Спам",
  insult: "Оскорбления",
  fake: "Недостоверный отзыв",
  other: "Другое",
  photo: "Фото в отзыве",
};

function orderStatus(value) {
  return ORDER_STATUS[value] || value || "";
}

function paymentMethod(value) {
  return PAYMENT_METHOD[value] || value || "";
}

function paymentStatus(value, method) {
  if (method === "cash" && value === "pending") return "Не оплачено";
  return PAYMENT_STATUS[value] || value || "";
}

function reviewReportReason(value) {
  return REVIEW_REPORT_REASON[value] || value || "";
}

module.exports = {
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  REVIEW_REPORT_REASON,
  orderStatus,
  paymentMethod,
  paymentStatus,
  reviewReportReason,
};
