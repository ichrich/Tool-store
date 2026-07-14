import { useEffect, useState, useCallback } from "react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { SafeImage } from "../components/SafeImage";
import {
  fetchProductBySlug,
  fetchReviews,
  createReview,
  updateReview,
  deleteReview,
  reportReview,
  fetchRecommendations,
} from "../api/publicApi";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ConfirmModal } from "../components/ConfirmModal";
import { ProductCard } from "../components/ProductCard";
import { formatPrice, imgSrc, clamp, formatDate } from "../utils/format";
import { Settings, ShieldCheck } from "lucide-react";

function clampQty(q, stock) {
  const max = Math.min(999, Math.max(0, Number(stock) || 0));
  if (max <= 0) return 1;
  return clamp(q, 1, max);
}

function groupProductCharacteristics(items) {
  const groups = new Map();

  for (const item of items || []) {
    if (!groups.has(item.characteristic_id)) {
      groups.set(item.characteristic_id, {
        id: item.characteristic_id,
        name: item.characteristic_name,
        values: [],
      });
    }

    groups.get(item.characteristic_id).values.push(item.value);
  }

  return [...groups.values()];
}

export function ProductPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const reviewHighlightId = searchParams.get("review");
  const { addItem } = useCart();
  const { isAuthenticated, isAdmin, user } = useAuth();
  const location = useLocation();
  const { success, error: showError, warning } = useToast();

  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState({ items: [], avg_rating: null });
  const [recs, setRecs] = useState([]);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    body: "",
    files: [],
  });
  const [editingId, setEditingId] = useState(null);
  const [reportModal, setReportModal] = useState(null);
  const [reportData, setReportData] = useState({
    reason: "other",
    comment: "",
    review_image_id: null,
  });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const loadReviews = useCallback((productId) => {
    fetchReviews(productId)
      .then(setReviews)
      .catch(() => setReviews({ items: [], avg_rating: null }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchProductBySlug(slug)
      .then((p) => {
        if (!cancelled) {
          setProduct(p);
          setQty(clampQty(1, p.stock));
          loadReviews(p.id);
        }
      })
      .catch(() => {
        if (!cancelled) setProduct(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, loadReviews]);

  useEffect(() => {
    fetchRecommendations()
      .then((d) => setRecs(d.items || []))
      .catch(() => setRecs([]));
  }, [slug]);

  useEffect(() => {
    if (!reviewHighlightId || !reviews.items?.length) return;
    const t = setTimeout(() => {
      const el = document.getElementById(`review-${reviewHighlightId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(t);
  }, [reviewHighlightId, reviews.items]);

  if (loading) {
    return (
      <div className="container page-loading">
        <div className="spinner spinner--lg" />
      </div>
    );
  }
  if (!product) {
    return (
      <div className="container">
        <Breadcrumbs
          items={[
            { label: "Главная", to: "/" },
            { label: "Каталог", to: "/catalog" },
            { label: "Товар не найден" },
          ]}
        />
        <div className="alert alert--error">
          Товар не найден или снят с продажи
        </div>
        <Link to="/catalog" className="btn btn--primary">
          В каталог
        </Link>
      </div>
    );
  }

  const src = imgSrc(product.image_path);
  const maxQ = product.stock <= 0 ? 0 : Math.min(999, Number(product.stock));
  const productCharacteristics = groupProductCharacteristics(
    product.characteristics,
  );

  function handleQtyChange(raw) {
    if (product.stock <= 0) return;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      setQty(1);
      return;
    }
    setQty(clampQty(n, product.stock));
  }

  function handleAddCart() {
    if (product.stock <= 0) {
      warning("Нет в наличии");
      return;
    }
    const result = addItem(product, qty);
    if (result?.reason === "max_quantity") {
      warning(
        `В корзине уже максимальное количество товара: ${result.max} шт.`,
      );
      return;
    }
    success(`Добавлено: ${product.name} (${qty} шт.)`);
  }

  async function submitReview(e) {
    e.preventDefault();
    if (!reviewForm.body.trim()) {
      showError("Напишите текст отзыва");
      return;
    }
    try {
      if (editingId) {
        await updateReview(editingId, {
          rating: reviewForm.rating,
          body: reviewForm.body.trim(),
        });
        success("Отзыв обновлён");
        setEditingId(null);
      } else {
        await createReview(product.id, {
          rating: reviewForm.rating,
          body: reviewForm.body.trim(),
          files: reviewForm.files?.length ? reviewForm.files : undefined,
        });
        success("Отзыв опубликован");
      }
      setReviewForm({ rating: 5, body: "", files: [] });
      loadReviews(product.id);
      fetchProductBySlug(slug)
        .then(setProduct)
        .catch(() => {});
    } catch (err) {
      showError(err.userMessage || "Не удалось сохранить отзыв");
    }
  }

  async function doDeleteReview() {
    try {
      await deleteReview(confirmDelete);
      success("Отзыв удалён");
      setConfirmDelete(null);
      loadReviews(product.id);
      fetchProductBySlug(slug)
        .then(setProduct)
        .catch(() => {});
    } catch (e) {
      showError(e.userMessage);
      setConfirmDelete(null);
    }
  }

  async function submitReport() {
    if (reportData.reason === "photo" && !reportData.review_image_id) {
      showError("Выберите фотографию, на которую жалуетесь");
      return;
    }
    try {
      const payload = {
        reason: reportData.reason,
        comment: reportData.comment || undefined,
        review_image_id:
          reportData.reason === "photo"
            ? reportData.review_image_id
            : undefined,
      };
      await reportReview(reportModal, payload);
      success("Жалоба отправлена");
      setReportModal(null);
      setReportData({ reason: "other", comment: "", review_image_id: null });
    } catch (e) {
      showError(e.userMessage);
    }
  }

  const myReviews = (reviews.items || []).filter((r) => r.user_id === user?.id);

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { label: "Главная", to: "/" },
          { label: "Каталог", to: "/catalog" },
          {
            label: product.category_name,
            to: `/catalog?category=${encodeURIComponent(product.category_slug)}`,
          },
          { label: product.name },
        ]}
      />

      {isAdmin && (
        <div className="admin-context-bar">
          <span>
            <ShieldCheck size={18} />
            Инструменты администратора
          </span>
          <Link
            className="btn btn--primary"
            to={`/admin/products/${product.id}`}
            state={{ from: `${location.pathname}${location.search}` }}
          >
            <Settings size={17} />
            Редактировать товар
          </Link>
          <Link
            className="btn"
            to={`/admin/reviews?product=${product.id}`}
            state={{ from: `${location.pathname}${location.search}` }}
          >
            Модерировать отзывы
          </Link>
        </div>
      )}

      <div className="two-col-responsive">
        <div>
          <SafeImage
            src={src}
            alt={product.name}
            width={640}
            height={480}
            className="product-detail-image"
          />
        </div>
        <div>
          <h1 style={{ marginBottom: "var(--space-3)" }}>{product.name}</h1>
          <p className="muted">
            Категория:{" "}
            <Link
              to={`/catalog?category=${encodeURIComponent(product.category_slug)}`}
            >
              {product.category_name}
            </Link>
          </p>
          {reviews.avg_rating && (
            <p className="muted">
              Рейтинг:{" "}
              <strong style={{ color: "var(--color-warning)" }}>
                {reviews.avg_rating}
              </strong>{" "}
              ({reviews.items?.length || 0} отз.)
            </p>
          )}
          <p
            className="price"
            style={{ fontSize: "1.75rem", margin: "var(--space-4) 0" }}
          >
            {formatPrice(product.price)}
          </p>
          <div
            style={{
              whiteSpace: "pre-wrap",
              color: "var(--color-text-secondary)",
              marginBottom: "var(--space-4)",
            }}
          >
            {product.description}
          </div>
          {productCharacteristics.length > 0 && (
            <dl className="product-characteristics-list">
              {productCharacteristics.map((characteristic) => (
                <div key={characteristic.id}>
                  <dt>{characteristic.name}</dt>
                  <dd>{characteristic.values.join(", ")}</dd>
                </div>
              ))}
            </dl>
          )}
          <p
            style={{
              color:
                product.stock > 0
                  ? "var(--color-success)"
                  : "var(--color-error)",
              fontWeight: 600,
            }}
          >
            {product.stock > 0
              ? `В наличии: ${product.stock} шт.`
              : "Нет в наличии"}
          </p>

          <div
            className="row"
            style={{
              marginTop: "var(--space-5)",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <label htmlFor="qty" className="muted">
              Кол-во
            </label>
            <input
              id="qty"
              className="input"
              style={{ width: 88 }}
              type="number"
              min={1}
              max={maxQ}
              value={qty}
              disabled={product.stock <= 0}
              onChange={(e) => handleQtyChange(e.target.value)}
            />
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              макс. {maxQ}
            </span>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleAddCart}
              disabled={product.stock <= 0}
            >
              В корзину
            </button>
            <Link className="btn btn--secondary" to="/cart">
              Корзина
            </Link>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section style={{ marginTop: "var(--space-8)" }}>
        <h2 className="section-title">Отзывы</h2>

        {isAuthenticated &&
          product.review_quota &&
          product.review_quota.remaining === 0 &&
          myReviews.length > 0 && (
            <div
              className="alert alert--info"
              style={{ marginBottom: "var(--space-4)" }}
            >
              Вы оставили максимум отзывов по числу купленных единиц этого
              товара ({product.review_quota.purchased_units} шт. в заказах).
            </div>
          )}

        {isAuthenticated && (product.can_review || editingId) && (
          <div
            id="review-form-anchor"
            className="card"
            style={{ marginBottom: "var(--space-5)" }}
          >
            <div className="card__body">
              <h3>{editingId ? "Редактировать отзыв" : "Новый отзыв"}</h3>
              {/* {!editingId && product.review_quota && (
                <p className="muted" style={{ marginBottom: 'var(--space-3)', fontSize: '0.9rem' }}>
                  Доступно отзывов по покупкам: осталось {product.review_quota.remaining} из {product.review_quota.purchased_units}.
                </p>
              )} */}
              <form onSubmit={submitReview}>
                <div className="field">
                  <label>Оценка</label>
                  <div className="stars">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`star ${n <= reviewForm.rating ? "star--filled" : ""}`}
                        onClick={() =>
                          setReviewForm((f) => ({ ...f, rating: n }))
                        }
                        aria-label={`Оценка ${n}`}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label>Текст</label>
                  <textarea
                    className="textarea"
                    rows={4}
                    value={reviewForm.body}
                    onChange={(e) =>
                      setReviewForm((f) => ({ ...f, body: e.target.value }))
                    }
                    placeholder="Расскажите о товаре"
                  />
                </div>
                {!editingId && (
                  <div className="field">
                    <label>Фото к отзыву (до 3 шт.)</label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="input"
                      onChange={(e) => {
                        const picked = Array.from(e.target.files || []).slice(
                          0,
                          3,
                        );
                        setReviewForm((f) => ({ ...f, files: picked }));
                      }}
                    />
                    {reviewForm.files?.length > 0 && (
                      <p
                        className="muted"
                        style={{ fontSize: "0.85rem", marginTop: 6 }}
                      >
                        Выбрано файлов: {reviewForm.files.length}
                      </p>
                    )}
                  </div>
                )}
                <div className="row">
                  <button type="submit" className="btn btn--primary">
                    {editingId ? "Сохранить" : "Отправить"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => {
                        setEditingId(null);
                        setReviewForm({ rating: 5, body: "", files: [] });
                      }}
                    >
                      Отмена
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {isAuthenticated && !product.can_review && !editingId && (
          <div className="alert alert--info">
            {product.review_quota?.purchased_units > 0
              ? "Вы оставили все отзывы по купленному количеству этого товара."
              : "Оставлять отзывы можно только после покупки этого товара."}
          </div>
        )}

        <div className="stack" style={{ gap: "var(--space-4)" }}>
          {(reviews.items || []).map((r) => (
            <div
              key={r.id}
              id={`review-${r.id}`}
              className="card"
              style={
                String(reviewHighlightId) === String(r.id)
                  ? {
                      outline: "2px solid var(--color-accent)",
                      outlineOffset: 2,
                    }
                  : undefined
              }
            >
              <div className="card__body">
                <div
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
                  <div>
                    <strong>{r.first_name || r.email?.split("@")[0]}</strong>
                    <span className="muted" style={{ marginLeft: 8 }}>
                      {formatDate(r.created_at)}
                    </span>
                  </div>
                  <span style={{ color: "var(--color-warning)" }}>
                    {"★".repeat(r.rating)}
                  </span>
                </div>
                <p style={{ marginTop: "var(--space-3)" }}>{r.body}</p>
                {(r.images || []).length > 0 && (
                  <div
                    className="row"
                    style={{ marginTop: "var(--space-3)", flexWrap: "wrap" }}
                  >
                    {(r.images || []).map((im) => {
                      const path = typeof im === "string" ? im : im.image_path;
                      const key =
                        typeof im === "object" && im.id != null ? im.id : path;
                      return (
                        <SafeImage
                          key={key}
                          src={imgSrc(path)}
                          alt="Фотография к отзыву"
                          width={120}
                          height={90}
                          className="review-image"
                          style={{
                            objectFit: "cover",
                            borderRadius: "var(--radius-sm)",
                          }}
                        />
                      );
                    })}
                  </div>
                )}
                {isAuthenticated && r.user_id === user?.id && (
                  <div className="row" style={{ marginTop: "var(--space-3)" }}>
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => {
                        setEditingId(r.id);
                        setReviewForm({
                          rating: r.rating,
                          body: r.body,
                          files: [],
                        });
                        document
                          .getElementById("review-form-anchor")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                      }}
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      onClick={() => setConfirmDelete(r.id)}
                    >
                      Удалить
                    </button>
                  </div>
                )}
                {isAuthenticated && r.user_id !== user?.id && (
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost review-action"
                    onClick={() => {
                      setReportModal(r.id);
                      setReportData({
                        reason: "other",
                        comment: "",
                        review_image_id: null,
                      });
                    }}
                  >
                    Пожаловаться
                  </button>
                )}
                {isAdmin && (
                  <Link
                    className="btn btn--sm btn--secondary review-action"
                    to={`/admin/reviews?product=${product.id}&review=${r.id}`}
                    state={{ from: `${location.pathname}${location.search}` }}
                  >
                    Модерировать отзыв
                  </Link>
                )}
              </div>
            </div>
          ))}
          {(!reviews.items || reviews.items.length === 0) && (
            <p className="muted">Пока нет отзывов</p>
          )}
        </div>
      </section>

      {recs.length > 0 && (
        <section style={{ marginTop: "var(--space-8)" }}>
          <h2 className="section-title">Рекомендуем</h2>
          <div className="grid-products">
            {recs
              .filter((p) => p.id !== product.id)
              .slice(0, 4)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </section>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Удалить отзыв?"
        onConfirm={doDeleteReview}
        onCancel={() => setConfirmDelete(null)}
      />

      {reportModal && (
        <div className="modal-overlay" onClick={() => setReportModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">Жалоба на отзыв</h3>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => setReportModal(null)}
              >
                x
              </button>
            </div>
            <div className="modal__body">
              <div className="field">
                <label>Причина</label>
                <select
                  className="select"
                  value={reportData.reason}
                  onChange={(e) =>
                    setReportData((d) => ({
                      ...d,
                      reason: e.target.value,
                      review_image_id:
                        e.target.value === "photo" ? d.review_image_id : null,
                    }))
                  }
                >
                  <option value="spam">Спам</option>
                  <option value="insult">Оскорбления</option>
                  <option value="fake">Недостоверно</option>
                  <option value="other">Другое</option>
                  <option value="photo">Фото в отзыве</option>
                </select>
              </div>
              {reportData.reason === "photo" && (
                <div className="field">
                  <label>Какое фото</label>
                  <p
                    className="muted"
                    style={{ fontSize: "0.85rem", marginBottom: 8 }}
                  >
                    Выберите изображение из этого отзыва
                  </p>
                  <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                    {(reviews.items || [])
                      .find((x) => x.id === reportModal)
                      ?.images?.map((im) => {
                        const path =
                          typeof im === "string" ? im : im.image_path;
                        const id =
                          typeof im === "object" && im.id != null
                            ? im.id
                            : null;
                        if (id == null) return null;
                        const sel = reportData.review_image_id === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`btn btn--sm${sel ? " btn--primary" : ""}`}
                            style={{ padding: 4 }}
                            onClick={() =>
                              setReportData((d) => ({
                                ...d,
                                review_image_id: id,
                              }))
                            }
                          >
                            <SafeImage
                              src={imgSrc(path)}
                              alt="Фотография к отзыву"
                              width={96}
                              height={72}
                              className="review-image"
                              style={{
                                objectFit: "cover",
                                display: "block",
                                borderRadius: 4,
                              }}
                            />
                          </button>
                        );
                      })}
                  </div>
                  {!(
                    (reviews.items || []).find((x) => x.id === reportModal)
                      ?.images || []
                  ).some((im) => typeof im === "object" && im.id != null) && (
                    <p
                      className="muted"
                      style={{ fontSize: "0.85rem", marginTop: 8 }}
                    >
                      У этого отзыва нет прикреплённых фото.
                    </p>
                  )}
                </div>
              )}
              <div className="field">
                <label>Комментарий</label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={reportData.comment}
                  onChange={(e) =>
                    setReportData((d) => ({ ...d, comment: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn" onClick={() => setReportModal(null)}>
                Отмена
              </button>
              <button className="btn btn--primary" onClick={submitReport}>
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
