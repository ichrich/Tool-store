import { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  adminFetchReviews,
  adminApproveReview,
  adminRejectReview,
  adminDeleteReview,
  adminFetchReports,
  adminResolveReport,
} from "../../api/adminApi";
import { useToast } from "../../context/ToastContext";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ModalPortal } from "../../components/ModalPortal";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { Pagination } from "../../components/Pagination";
import { formatDate, imgSrc } from "../../utils/format";
import { useReviewRestrictionCountdown } from "../../components/ReviewRestrictionModal";

const REASON_LABEL = {
  spam: "Спам",
  insult: "Оскорбления",
  fake: "Недостоверно",
  other: "Другое",
  photo: "Фото",
};

function StarsRow({ rating }) {
  const r = Number(rating) || 0;
  return (
    <span style={{ color: "var(--color-warning)" }}>
      {"★".repeat(r)}
      {"☆".repeat(Math.max(0, 5 - r))}
    </span>
  );
}

function AuthorSuspCell({ until, permCount }) {
  const left = useReviewRestrictionCountdown(until || null);
  if (Number(permCount) > 0) {
    return (
      <span className="muted" style={{ fontSize: "0.75rem" }}>
        Есть бессрочные ограничения
      </span>
    );
  }
  if (!until) return <span className="muted">—</span>;
  return (
    <span className="muted" style={{ fontSize: "0.75rem" }}>
      До {formatDate(until)} ({left})
    </span>
  );
}

function SortTh({ label, field, sort, order, onSort }) {
  const active = sort === field;
  return (
    <th>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        style={{ fontWeight: active ? 700 : 500, padding: "2px 4px" }}
        onClick={() => onSort(field)}
      >
        {label}
        {active ? (order === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

export function AdminReviewsPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const productId = Number(searchParams.get("product")) || undefined;
  const highlightedReviewId = searchParams.get("review");
  const returnTo = location.state?.from;
  const { success, error: showError } = useToast();
  const [tab, setTab] = useState("reviews");
  const [reportArchive, setReportArchive] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [reviewSearch, setReviewSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");

  const [reviewSort, setReviewSort] = useState("created_at");
  const [reviewOrder, setReviewOrder] = useState("desc");
  const [reportSort, setReportSort] = useState("created_at");
  const [reportOrder, setReportOrder] = useState("desc");

  const [resolveModal, setResolveModal] = useState(null);
  const [resolveForm, setResolveForm] = useState({
    action: "dismiss",
    sanction: "review_ban_days",
    sanction_days: 7,
    admin_note: "",
    delete_all_reviews: false,
  });

  const toggleReviewSort = useCallback((field) => {
    setReviewSort((prev) => {
      if (prev === field) {
        setReviewOrder((o) => (o === "asc" ? "desc" : "asc"));
        return prev;
      }
      setReviewOrder("desc");
      return field;
    });
    setPage(1);
  }, []);

  const toggleReportSort = useCallback((field) => {
    setReportSort((prev) => {
      if (prev === field) {
        setReportOrder((o) => (o === "asc" ? "desc" : "asc"));
        return prev;
      }
      setReportOrder("desc");
      return field;
    });
    setPage(1);
  }, []);

  function loadReviews() {
    setLoading(true);
    adminFetchReviews({
      page,
      limit,
      status: "all",
      search: reviewSearch || undefined,
      product_id: productId,
      sort: reviewSort,
      order: reviewOrder,
    })
      .then((d) => {
        setReviews(d.items);
        setTotal(d.total);
      })
      .catch((e) => showError(e.userMessage))
      .finally(() => setLoading(false));
  }

  function loadReports() {
    setLoading(true);
    adminFetchReports({
      page,
      limit,
      archive: reportArchive ? "true" : "false",
      search: reportSearch || undefined,
      sort: reportSort,
      order: reportOrder,
    })
      .then((d) => {
        setReports(d.items);
        setTotal(d.total);
      })
      .catch((e) => showError(e.userMessage))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (tab === "reviews") loadReviews();
    else loadReports();
  }, [
    tab,
    page,
    limit,
    reportArchive,
    reviewSort,
    reviewOrder,
    reportSort,
    reportOrder,
    reviewSearch,
    reportSearch,
    productId,
  ]);

  async function approve(id) {
    try {
      await adminApproveReview(id);
      success("Отзыв одобрен");
      loadReviews();
    } catch (e) {
      showError(e.userMessage);
    }
  }

  async function reject(id) {
    try {
      await adminRejectReview(id);
      success("Отзыв скрыт");
      loadReviews();
    } catch (e) {
      showError(e.userMessage);
    }
  }

  async function doDelete() {
    try {
      await adminDeleteReview(confirm.id);
      success("Отзыв удалён");
      setConfirm(null);
      loadReviews();
    } catch (e) {
      showError(e.userMessage);
      setConfirm(null);
    }
  }

  function openResolve(r) {
    setResolveModal(r);
    setResolveForm({
      action: "dismiss",
      sanction: "review_ban_days",
      sanction_days: 7,
      admin_note: "",
      delete_all_reviews: false,
    });
  }

  async function submitResolve() {
    if (!resolveModal) return;
    const body =
      resolveForm.action === "dismiss"
        ? { action: "dismiss", admin_note: resolveForm.admin_note || undefined }
        : {
            action: "accept",
            sanction: resolveForm.sanction,
            sanction_days:
              resolveForm.sanction === "review_ban_days"
                ? Number(resolveForm.sanction_days)
                : undefined,
            admin_note: resolveForm.admin_note || undefined,
            ...(resolveForm.sanction === "account_block" &&
            resolveForm.delete_all_reviews
              ? { delete_all_reviews: true }
              : {}),
          };
    try {
      await adminResolveReport(resolveModal.id, body);
      success("Жалоба обработана");
      setResolveModal(null);
      loadReports();
    } catch (e) {
      showError(e.userMessage);
    }
  }

  return (
    <div>
      {returnTo && (
        <Link className="back-link admin-return-link" to={returnTo}>
          ← Вернуться на страницу товара
        </Link>
      )}
      <Breadcrumbs
        items={[
          { label: "Панель", to: "/admin/dashboard" },
          { label: "Отзывы" },
        ]}
      />
      <h1 style={{ marginBottom: "var(--space-5)" }}>Модерация отзывов</h1>

      <div
        className="row"
        style={{
          marginBottom: "var(--space-4)",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        <button
          type="button"
          className={`btn${tab === "reviews" ? " btn--primary" : ""}`}
          onClick={() => {
            setTab("reviews");
            setPage(1);
          }}
        >
          Отзывы
        </button>
        <button
          type="button"
          className={`btn${tab === "reports" && !reportArchive ? " btn--primary" : ""}`}
          onClick={() => {
            setTab("reports");
            setReportArchive(false);
            setPage(1);
          }}
        >
          Жалобы (очередь)
        </button>
        <button
          type="button"
          className={`btn${tab === "reports" && reportArchive ? " btn--primary" : ""}`}
          onClick={() => {
            setTab("reports");
            setReportArchive(true);
            setPage(1);
          }}
        >
          Архив жалоб
        </button>
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="spinner spinner--lg" />
        </div>
      ) : tab === "reviews" ? (
        <>
          <div className="field" style={{ maxWidth: 360 }}>
            <label>Поиск по отзывам</label>
            <input
              className="input"
              value={reviewSearch}
              onChange={(e) => setReviewSearch(e.target.value)}
              placeholder="Товар, автор, текст"
            />
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <SortTh
                    label="Товар"
                    field="product_name"
                    sort={reviewSort}
                    order={reviewOrder}
                    onSort={toggleReviewSort}
                  />
                  <SortTh
                    label="Автор"
                    field="user_email"
                    sort={reviewSort}
                    order={reviewOrder}
                    onSort={toggleReviewSort}
                  />
                  <SortTh
                    label="Оценка"
                    field="rating"
                    sort={reviewSort}
                    order={reviewOrder}
                    onSort={toggleReviewSort}
                  />
                  <th>Текст</th>
                  <SortTh
                    label="Дата"
                    field="created_at"
                    sort={reviewSort}
                    order={reviewOrder}
                    onSort={toggleReviewSort}
                  />
                  <SortTh
                    label="Статус"
                    field="status"
                    sort={reviewSort}
                    order={reviewOrder}
                    onSort={toggleReviewSort}
                  />
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr
                    key={r.id}
                    className={
                      String(highlightedReviewId) === String(r.id)
                        ? "admin-highlight-row"
                        : ""
                    }
                  >
                    <td>
                      <Link
                        to={`/product/${encodeURIComponent(r.product_slug)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {r.product_name}
                      </Link>
                      <div className="muted" style={{ fontSize: "0.75rem" }}>
                        <Link to={`/admin/products/${r.product_id}`}>
                          Админ: товар #{r.product_id}
                        </Link>
                      </div>
                    </td>
                    <td className="muted">
                      <Link
                        to={`/admin/users?search=${encodeURIComponent(r.user_email || "")}`}
                      >
                        {r.user_email}
                      </Link>
                    </td>
                    <td>
                      <StarsRow rating={r.rating} />
                    </td>
                    <td className="admin-text-cell">
                      <span style={{ fontSize: "0.85rem" }}>
                        {(r.body || "").slice(0, 80)}
                        {(r.body || "").length > 80 ? "..." : ""}
                      </span>
                    </td>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>
                      {formatDate(r.created_at)}
                    </td>
                    <td>
                      <span
                        className={`badge badge--${r.status === "approved" ? "completed" : "cancelled"}`}
                      >
                        {r.status === "approved"
                          ? "Одобрен"
                          : r.status === "pending"
                            ? "На проверке"
                            : "Скрыт"}
                      </span>
                    </td>
                    <td>
                      <div className="admin-action-stack">
                        {r.status !== "approved" ? (
                          <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => approve(r.id)}
                          >
                            Одобрить
                          </button>
                        ) : null}
                        {r.status === "approved" ? (
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() => reject(r.id)}
                          >
                            Скрыть
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          onClick={() => setConfirm({ id: r.id, text: r.body })}
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </>
      ) : (
        <>
          <div className="field" style={{ maxWidth: 360 }}>
            <label>Поиск по жалобам</label>
            <input
              className="input"
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              placeholder="ID, товар, email, комментарий"
            />
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Отзыв / товар</th>
                  <th>Жалобщик</th>
                  <SortTh
                    label="Причина"
                    field="reason"
                    sort={reportSort}
                    order={reportOrder}
                    onSort={toggleReportSort}
                  />
                  <SortTh
                    label="Дата"
                    field="created_at"
                    sort={reportSort}
                    order={reportOrder}
                    onSort={toggleReportSort}
                  />
                  <SortTh
                    label="Статус"
                    field="status"
                    sort={reportSort}
                    order={reportOrder}
                    onSort={toggleReportSort}
                  />
                  <th>Ограничение автора</th>
                  <th>Решение</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="admin-text-cell admin-text-cell--wide">
                      <div>
                        {(r.review_body || "").slice(0, 80)}
                        {(r.review_body || "").length > 80 ? "..." : ""}
                      </div>
                      <div className="muted">
                        Товар:{" "}
                        <Link
                          to={`/product/${encodeURIComponent(r.product_slug)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {r.product_name}
                        </Link>
                      </div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        <Link
                          to={`/product/${encodeURIComponent(r.product_slug)}?review=${r.review_id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Открыть этот отзыв на сайте
                        </Link>
                      </div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        Автор отзыва: {r.reviewed_user_email}
                      </div>
                      {r.reported_image_path && (
                        <div style={{ marginTop: 6 }}>
                          <span className="badge">Фото в жалобе</span>
                          <img
                            src={imgSrc(r.reported_image_path)}
                            alt=""
                            style={{
                              maxWidth: 120,
                              maxHeight: 90,
                              borderRadius: 6,
                              display: "block",
                              marginTop: 4,
                            }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="muted">{r.reporter_email}</td>
                    <td>
                      <span className="badge">
                        {REASON_LABEL[r.reason] || r.reason}
                      </span>
                      {r.comment && (
                        <div
                          className="muted"
                          style={{ fontSize: "0.8rem", marginTop: 2 }}
                        >
                          {r.comment}
                        </div>
                      )}
                    </td>
                    <td className="muted">{formatDate(r.created_at)}</td>
                    <td>
                      <span className="badge">
                        {r.status === "pending"
                          ? "В очереди"
                          : r.status === "reviewed"
                            ? "Принята"
                            : "Отклонена"}
                      </span>
                    </td>
                    <td>
                      <AuthorSuspCell
                        until={r.author_suspension_until}
                        permCount={r.author_perm_susp_count}
                      />
                    </td>
                    <td className="muted" style={{ fontSize: "0.8rem" }}>
                      {r.resolved_at ? formatDate(r.resolved_at) : "—"}
                      {r.reviewer_sanction &&
                        r.reviewer_sanction !== "none" && (
                          <div
                            className="muted"
                            style={{ fontSize: "0.75rem", marginTop: 4 }}
                          >
                            Санкция:{" "}
                            {r.reviewer_sanction === "account_block"
                              ? "блокировка"
                              : r.reviewer_sanction === "review_ban"
                                ? `ограничение ${r.sanction_days || "?"} дн.`
                                : r.reviewer_sanction}
                          </div>
                        )}
                    </td>
                    <td>
                      {r.status === "pending" ? (
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          onClick={() => openResolve(r)}
                        >
                          Обработать
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </>
      )}

      <ConfirmModal
        open={!!confirm}
        title="Удалить отзыв?"
        message={confirm && `Отзыв: "${(confirm.text || "").slice(0, 100)}..."`}
        confirmText="Удалить"
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />

      {resolveModal && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setResolveModal(null)}>
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 480 }}
            >
              <div className="modal__header">
                <h3 className="modal__title">
                  Обработка жалобы #{resolveModal.id}
                </h3>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setResolveModal(null)}
                >
                  ×
                </button>
              </div>
              <div className="modal__body">
                <div className="field">
                  <label>Действие</label>
                  <select
                    className="select"
                    value={resolveForm.action}
                    onChange={(e) =>
                      setResolveForm((f) => ({ ...f, action: e.target.value }))
                    }
                  >
                    <option value="dismiss">Отклонить жалобу</option>
                    <option value="accept">
                      Принять жалобу (санкция к автору отзыва)
                    </option>
                  </select>
                </div>
                {resolveForm.action === "accept" && (
                  <>
                    <div className="field">
                      <label>Мера</label>
                      <select
                        className="select"
                        value={resolveForm.sanction}
                        onChange={(e) =>
                          setResolveForm((f) => ({
                            ...f,
                            sanction: e.target.value,
                          }))
                        }
                      >
                        <option value="review_ban_days">
                          Запрет написание отзывов
                        </option>
                        <option value="account_block">
                          Блокировка аккаунта
                        </option>
                      </select>
                    </div>
                    {resolveForm.sanction === "review_ban_days" && (
                      <div className="field">
                        <label>Дней</label>
                        <input
                          type="number"
                          min={1}
                          max={3650}
                          className="input"
                          value={resolveForm.sanction_days}
                          onChange={(e) =>
                            setResolveForm((f) => ({
                              ...f,
                              sanction_days: e.target.value,
                            }))
                          }
                        />
                      </div>
                    )}
                    {resolveForm.sanction === "account_block" && (
                      <div className="field">
                        <label
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={!!resolveForm.delete_all_reviews}
                            onChange={(e) =>
                              setResolveForm((f) => ({
                                ...f,
                                delete_all_reviews: e.target.checked,
                              }))
                            }
                          />
                          Удалить все отзывы пользователя (мягкое удаление)
                        </label>
                      </div>
                    )}
                  </>
                )}
                <div className="field">
                  <label>Комментарий модератора (необязательно)</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={resolveForm.admin_note}
                    onChange={(e) =>
                      setResolveForm((f) => ({
                        ...f,
                        admin_note: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="modal__footer">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setResolveModal(null)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={submitResolve}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
