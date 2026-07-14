import client from "./client";

export const fetchCategories = () =>
  client.get("/categories").then((r) => r.data);
export const fetchRecommendedCategoryProducts = (slug, params) =>
  client
    .get(`/categories/${encodeURIComponent(slug)}/recommended-products`, {
      params,
    })
    .then((r) => r.data);
export const fetchBrands = (params) =>
  client.get("/brands", { params }).then((r) => r.data);

export const fetchProducts = (params) =>
  client.get("/products", { params }).then((r) => r.data);

export const fetchProductBySlug = (slug) =>
  client.get(`/products/${encodeURIComponent(slug)}`).then((r) => r.data);

export const fetchProductStock = (id) =>
  client.get(`/products/id/${id}/stock`).then((r) => r.data.stock);

export const fetchArticles = () => client.get("/articles").then((r) => r.data);

export const fetchArticleBySlug = (slug) =>
  client.get(`/articles/${encodeURIComponent(slug)}`).then((r) => r.data);

export const createOrder = (payload) =>
  client.post("/orders", payload).then((r) => r.data);

export const fetchMyOrders = (params) =>
  client.get("/my-orders", { params }).then((r) => r.data);

export const fetchMyOrderDetail = (id) =>
  client.get(`/my-orders/${id}`).then((r) => r.data);
export const cancelMyOrder = (id) =>
  client.patch(`/my-orders/${id}/cancel`).then((r) => r.data);
export const requestMyOrderCancel = (id, data) =>
  client.post(`/my-orders/${id}/cancel-request`, data).then((r) => r.data);

export const simulateOrderPaymentDemo = (id, success) =>
  client
    .patch(`/my-orders/${id}/payment-demo`, { success })
    .then((r) => r.data);

export const fetchRecommendations = () =>
  client.get("/recommendations").then((r) => r.data);

// Cart (server-side)
export const fetchCart = () => client.get("/cart").then((r) => r.data);
export const upsertCartItem = (product_id, quantity) =>
  client.post("/cart", { product_id, quantity }).then((r) => r.data);
export const removeCartItem = (productId) =>
  client.delete(`/cart/${productId}`).then((r) => r.data);
export const clearCart = () => client.delete("/cart").then((r) => r.data);

// Reviews
export const fetchReviews = (productId) =>
  client.get(`/products/${productId}/reviews`).then((r) => r.data);

export function createReview(productId, { rating, body, files }) {
  if (files && files.length) {
    const fd = new FormData();
    fd.append("rating", String(rating));
    fd.append("body", body);
    files.slice(0, 3).forEach((f) => fd.append("images", f));
    return client
      .post(`/products/${productId}/reviews`, fd)
      .then((r) => r.data);
  }
  return client
    .post(`/products/${productId}/reviews`, { rating, body })
    .then((r) => r.data);
}
export const updateReview = (id, data) =>
  client.put(`/reviews/${id}`, data).then((r) => r.data);
export const deleteReview = (id) =>
  client.delete(`/reviews/${id}`).then((r) => r.data);
export const reportReview = (id, data) =>
  client.post(`/reviews/${id}/report`, data).then((r) => r.data);

// Discounts
export const validatePromo = (code, cart_total, items) =>
  client
    .post("/discounts/validate", { code, cart_total, items })
    .then((r) => r.data);

export const fetchNotifications = () =>
  client.get("/notifications").then((r) => r.data);
export const markNotificationRead = (id) =>
  client.patch(`/notifications/${id}/read`).then((r) => r.data);
export const fetchMyAppeals = () =>
  client.get("/appeals/my").then((r) => r.data);
export const createAppeal = (formData) =>
  client.post("/appeals", formData).then((r) => r.data);

// Payments
export const createPayment = (orderId, payment_token) =>
  client
    .post("/payment/create", {
      orderId,
      payment_token,
    })
    .then((r) => r.data);
export const checkPaymentStatus = (paymentId, orderId, payment_token) =>
  client
    .get("/payment/status", { params: { paymentId, orderId, payment_token } })
    .then((r) => r.data);
