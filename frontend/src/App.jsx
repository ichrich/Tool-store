import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { NotificationToaster } from "./components/NotificationToaster";
import { ProtectedRoute, RequireAuth } from "./components/ProtectedRoute";
import { PageMeta } from "./components/PageMeta";

import { HomePage } from "./pages/HomePage";
import { CatalogPage } from "./pages/CatalogPage";
import { ProductPage } from "./pages/ProductPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { CheckoutSuccessPage } from "./pages/CheckoutSuccessPage";
import { BlogListPage } from "./pages/BlogListPage";
import { BlogArticlePage } from "./pages/BlogArticlePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProfilePage } from "./pages/ProfilePage";
import { MyOrdersPage } from "./pages/MyOrdersPage";
import { MyOrderDetailPage } from "./pages/MyOrderDetailPage";

import { AdminLoginPage } from "./pages/admin/AdminLoginPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminCategoriesPage } from "./pages/admin/AdminCategoriesPage";
import { AdminProductsPage } from "./pages/admin/AdminProductsPage";
import { AdminProductFormPage } from "./pages/admin/AdminProductFormPage";
import { AdminOrdersPage } from "./pages/admin/AdminOrdersPage";
import { AdminOrderDetailPage } from "./pages/admin/AdminOrderDetailPage";
import { AdminArticlesPage } from "./pages/admin/AdminArticlesPage";
import { AdminArticleFormPage } from "./pages/admin/AdminArticleFormPage";
import { AdminReviewsPage } from "./pages/admin/AdminReviewsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminAppealsPage } from "./pages/admin/AdminAppealsPage";
import { AdminDiscountsPage } from "./pages/admin/AdminDiscountsPage";
import { AdminReportsPage } from "./pages/admin/AdminReportsPage";

export function App() {
  return (
    <>
      <NotificationToaster />
      <PageMeta />
      <Routes>
        {/* Public layout */}
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="product/:slug" element={<ProductPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="blog" element={<BlogListPage />} />
          <Route path="blog/:slug" element={<BlogArticlePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />

          {/* Auth-protected user pages */}
          <Route element={<RequireAuth />}>
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="my-orders" element={<MyOrdersPage />} />
            <Route path="my-orders/:id" element={<MyOrderDetailPage />} />
          </Route>
        </Route>

        {/* Admin */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<ProtectedRoute adminOnly={true} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="products/new" element={<AdminProductFormPage />} />
            <Route path="products/:id" element={<AdminProductFormPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="orders/:id" element={<AdminOrderDetailPage />} />
            <Route path="articles" element={<AdminArticlesPage />} />
            <Route path="articles/new" element={<AdminArticleFormPage />} />
            <Route path="articles/:id" element={<AdminArticleFormPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="appeals" element={<AdminAppealsPage />} />
            <Route path="discounts" element={<AdminDiscountsPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
