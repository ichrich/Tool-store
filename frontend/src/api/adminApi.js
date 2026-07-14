import client from "./client";

export const adminLogin = (body) =>
  client.post("/auth/login", body).then((r) => r.data);

// Категории
export const adminFetchCategories = () =>
  client.get("/admin/categories").then((r) => r.data);
export const adminFetchBrands = (params) =>
  client.get("/admin/brands", { params }).then((r) => r.data);
export const adminCreateCategory = (body) =>
  client.post("/admin/categories", body).then((r) => r.data);
export const adminUpdateCategory = (id, body) =>
  client.put(`/admin/categories/${id}`, body).then((r) => r.data);
export const adminDeleteCategory = (id) =>
  client.delete(`/admin/categories/${id}`).then((r) => r.data);

// Товары
export const adminFetchProducts = (params) =>
  client.get("/admin/products", { params }).then((r) => r.data);
export const adminFetchProduct = (id) =>
  client.get(`/admin/products/${id}`).then((r) => r.data);
export const adminCreateProduct = (formData) =>
  client.post("/admin/products", formData).then((r) => r.data);
export const adminUpdateProduct = (id, formData) =>
  client.put(`/admin/products/${id}`, formData).then((r) => r.data);
export const adminDeleteProduct = (id) =>
  client.delete(`/admin/products/${id}`).then((r) => r.data);
export const adminFetchCharacteristics = () =>
  client.get("/admin/characteristics").then((r) => r.data);

// Загрузка файлов
export const adminUploadFile = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return client.post("/admin/upload", fd).then((r) => r.data);
};

// Заказы
export const adminFetchOrders = (params) =>
  client.get("/admin/orders", { params }).then((r) => r.data);
export const adminFetchOrder = (id) =>
  client.get(`/admin/orders/${id}`).then((r) => r.data);
export const adminUpdateOrderStatus = (id, status) =>
  client.patch(`/admin/orders/${id}/status`, { status }).then((r) => r.data);
export const adminUpdateOrderAdminNote = (id, admin_note) =>
  client
    .patch(`/admin/orders/${id}/admin-note`, { admin_note })
    .then((r) => r.data);

// Статьи
export const adminFetchArticles = () =>
  client.get("/admin/articles").then((r) => r.data);
export const adminFetchArticle = (id) =>
  client.get(`/admin/articles/${id}`).then((r) => r.data);
export const adminCreateArticle = (body) =>
  client.post("/admin/articles", body).then((r) => r.data);
export const adminUpdateArticle = (id, body) =>
  client.put(`/admin/articles/${id}`, body).then((r) => r.data);
export const adminDeleteArticle = (id) =>
  client.delete(`/admin/articles/${id}`).then((r) => r.data);

// Отзывы
export const adminFetchReviews = (params) =>
  client.get("/admin/reviews", { params }).then((r) => r.data);
export const adminApproveReview = (id) =>
  client.patch(`/admin/reviews/${id}/approve`).then((r) => r.data);
export const adminRejectReview = (id) =>
  client.patch(`/admin/reviews/${id}/reject`).then((r) => r.data);
export const adminDeleteReview = (id) =>
  client.delete(`/admin/reviews/${id}`).then((r) => r.data);
export const adminFetchReports = (params) =>
  client.get("/admin/review-reports", { params }).then((r) => r.data);
export const adminResolveReport = (id, body) =>
  client.patch(`/admin/review-reports/${id}`, body).then((r) => r.data);

// Пользователи
export const adminFetchUsers = (params) =>
  client.get("/admin/users", { params }).then((r) => r.data);
export const adminFetchUserDetail = (id) =>
  client.get(`/admin/users/${id}/detail`).then((r) => r.data);
export const adminBlockUser = (id) =>
  client.patch(`/admin/users/${id}/block`).then((r) => r.data);
export const adminUnblockUser = (id) =>
  client.patch(`/admin/users/${id}/unblock`).then((r) => r.data);
export const adminSuspendUserReviews = (id, data) =>
  client.post(`/admin/users/${id}/suspend-reviews`, data).then((r) => r.data);
export const adminFetchAppeals = (params) =>
  client.get("/admin/appeals", { params }).then((r) => r.data);
export const adminResolveAppeal = (id, body) =>
  client.patch(`/admin/appeals/${id}`, body).then((r) => r.data);

// Промокоды
export const adminFetchDiscounts = () =>
  client.get("/admin/discounts").then((r) => r.data);
export const adminCreateDiscount = (body) =>
  client.post("/admin/discounts", body).then((r) => r.data);
export const adminUpdateDiscount = (id, body) =>
  client.put(`/admin/discounts/${id}`, body).then((r) => r.data);
export const adminDeleteDiscount = (id) =>
  client.delete(`/admin/discounts/${id}`).then((r) => r.data);

// Отчёты
export const adminGetOrdersReport = (params) =>
  client.get("/admin/reports/orders", { params }).then((r) => r.data);
export const adminGetProductsReport = () =>
  client.get("/admin/reports/products").then((r) => r.data);
export const adminGetUsersReport = () =>
  client.get("/admin/reports/users").then((r) => r.data);
export const downloadReport = (type, format, params = {}) =>
  client
    .get(`/admin/reports/${type}`, {
      params: { ...params, format },
      responseType: "blob",
    })
    .then((r) => r.data);
