import { Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import {
  adminFetchUsers,
  adminFetchUserDetail,
  adminBlockUser,
  adminUnblockUser,
  adminSuspendUserReviews,
} from "../../api/adminApi";
import { useToast } from "../../context/ToastContext";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ModalPortal } from "../../components/ModalPortal";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { Pagination } from "../../components/Pagination";
import { formatDate } from "../../utils/format";

function SortTh({ field, label, sort, order, onToggle }) {
  const active = sort === field;
  return (
    <th>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        style={{ fontWeight: active ? 700 : 500, padding: "2px 4px" }}
        onClick={() => onToggle(field)}
      >
        {label}
        {active ? (order === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}

export function AdminUsersPage() {
  const { success, error: showError } = useToast();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [suspendModal, setSuspendModal] = useState(null);
  const [suspendData, setSuspendData] = useState({
    reason: "",
    expires_at: "",
  });
  const [sort, setSort] = useState("created_at");
  const [order, setOrder] = useState("desc");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [userDetail, setUserDetail] = useState(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggleSort = useCallback((field) => {
    setSort((prev) => {
      if (prev === field) {
        setOrder((o) => (o === "asc" ? "desc" : "asc"));
        return prev;
      }
      setOrder("desc");
      return field;
    });
    setPage(1);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    adminFetchUsers({ page, limit, search, sort, order })
      .then((d) => {
        setUsers(d.items);
        setTotal(d.total);
      })
      .catch((e) => showError(e.userMessage))
      .finally(() => setLoading(false));
  }, [page, limit, search, sort, order, showError]);

  useEffect(() => {
    load();
  }, [load]);

  async function doBlock() {
    try {
      await adminBlockUser(confirm.id);
      success("Пользователь заблокирован");
      setConfirm(null);
      load();
    } catch (e) {
      showError(e.userMessage);
      setConfirm(null);
    }
  }

  async function handleUnblock(id) {
    try {
      await adminUnblockUser(id);
      success("Разблокирован");
      load();
    } catch (e) {
      showError(e.userMessage);
    }
  }

  async function doSuspend() {
    if (!suspendData.reason) {
      showError("Укажите причину");
      return;
    }
    try {
      await adminSuspendUserReviews(suspendModal.id, suspendData);
      success("Доступ к отзывам приостановлен");
      setSuspendModal(null);
      setSuspendData({ reason: "", expires_at: "" });
      load();
    } catch (e) {
      showError(e.userMessage);
    }
  }

  async function openUserDetail(id) {
    setUserDetail(null);
    setUserDetailLoading(true);
    try {
      const d = await adminFetchUserDetail(id);
      setUserDetail(d);
    } catch (e) {
      showError(e.userMessage);
      setUserDetail(null);
    } finally {
      setUserDetailLoading(false);
    }
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Панель", to: "/admin/dashboard" },
          { label: "Пользователи" },
        ]}
      />
      <h1 style={{ marginBottom: "var(--space-5)" }}>Пользователи</h1>

      <div className="row" style={{ marginBottom: "var(--space-4)" }}>
        <input
          className="input"
          style={{ maxWidth: 300 }}
          placeholder="Поиск по email, имени..."
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="select"
          style={{ maxWidth: 180 }}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Все роли</option>
          <option value="admin">Админ</option>
          <option value="user">Пользователь</option>
        </select>
        <select
          className="select"
          style={{ maxWidth: 200 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="blocked">Заблокированные</option>
        </select>
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="spinner spinner--lg" />
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <SortTh
                    field="id"
                    label="Номер"
                    sort={sort}
                    order={order}
                    onToggle={toggleSort}
                  />
                  <SortTh
                    field="email"
                    label="Email"
                    sort={sort}
                    order={order}
                    onToggle={toggleSort}
                  />
                  <SortTh
                    field="first_name"
                    label="Имя"
                    sort={sort}
                    order={order}
                    onToggle={toggleSort}
                  />
                  <SortTh
                    field="role"
                    label="Роль"
                    sort={sort}
                    order={order}
                    onToggle={toggleSort}
                  />
                  <SortTh
                    field="is_active"
                    label="Статус"
                    sort={sort}
                    order={order}
                    onToggle={toggleSort}
                  />
                  <th>Модерация</th>
                  <SortTh
                    field="created_at"
                    label="Дата"
                    sort={sort}
                    order={order}
                    onToggle={toggleSort}
                  />
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter((u) => {
                    if (roleFilter && u.role !== roleFilter) return false;
                    if (statusFilter === "active" && !u.is_active) return false;
                    if (statusFilter === "blocked" && u.is_active) return false;
                    return true;
                  })
                  .map((u) => (
                    <tr key={u.id}>
                      <td className="muted">{u.id}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          style={{ padding: "2px 4px", textAlign: "left" }}
                          onClick={() => openUserDetail(u.id)}
                        >
                          {u.email}
                        </button>
                      </td>
                      <td>
                        {u.first_name} {u.last_name}
                      </td>
                      <td>
                        <span className={`badge badge--${u.role}`}>
                          {u.role === "admin" ? "Адм." : "Пользователь"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge badge--${u.is_active ? "completed" : "cancelled"}`}
                        >
                          {u.is_active ? "Активен" : "Заблокирован"}
                        </span>
                      </td>
                      <td
                        className="muted"
                        style={{ fontSize: "0.8rem", maxWidth: 220 }}
                      >
                        {(Number(u.sanctions_count) || 0) +
                          (Number(u.reports_processed_count) || 0) ===
                        0 ? (
                          "—"
                        ) : (
                          <>
                            {(Number(u.sanctions_count) || 0) > 0 && (
                              <div>
                                Санкций (ограничения):{" "}
                                <strong>{u.sanctions_count}</strong>
                              </div>
                            )}
                            {(Number(u.reports_processed_count) || 0) > 0 && (
                              <div>
                                Обработано жалоб на отзывы:{" "}
                                <strong>{u.reports_processed_count}</strong>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="muted">{formatDate(u.created_at)}</td>
                      <td>
                        <div className="admin-action-stack">
                          <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => openUserDetail(u.id)}
                          >
                            Карточка
                          </button>
                          {u.is_active ? (
                            <button
                              type="button"
                              className="btn btn--sm btn--danger"
                              onClick={() =>
                                setConfirm({ id: u.id, email: u.email })
                              }
                            >
                              Блок
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--sm"
                              onClick={() => handleUnblock(u.id)}
                            >
                              Разблок
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() =>
                              setSuspendModal({ id: u.id, email: u.email })
                            }
                          >
                            Огр. отзывы
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
      )}

      {(userDetailLoading || userDetail) && (
        <ModalPortal>
          <div
            className="modal-overlay"
            onClick={() => {
              setUserDetail(null);
              setUserDetailLoading(false);
            }}
          >
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 760, maxHeight: "90vh", overflow: "auto" }}
            >
              <div className="modal__header">
                <h3 className="modal__title">Карточка пользователя</h3>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setUserDetail(null);
                    setUserDetailLoading(false);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal__body" style={{ fontSize: "0.875rem" }}>
                {userDetailLoading && <p>Загрузка…</p>}
                {!userDetailLoading && userDetail && (
                  <>
                    <p>
                      <strong>{userDetail.user.email}</strong> ·{" "}
                      {userDetail.user.first_name} {userDetail.user.last_name}
                    </p>
                    <p className="muted">
                      Номер {userDetail.user.id} · роль {userDetail.user.role} ·{" "}
                      {userDetail.user.is_active ? "активен" : "заблокирован"} ·
                      тел. {userDetail.user.phone || "—"}
                    </p>
                    <p className="muted">
                      VK: {userDetail.user.vk_user_id || "не привязан"}
                    </p>
                    <p className="muted">
                      Регистрация: {formatDate(userDetail.user.created_at)}
                    </p>

                    <h4 style={{ marginTop: "var(--space-4)" }}>Заказы</h4>
                    {(userDetail.orders || []).length === 0 ? (
                      <p className="muted">Нет</p>
                    ) : (
                      <ul style={{ paddingLeft: 18 }}>
                        {userDetail.orders.map((o) => (
                          <li key={o.id}>
                            <Link to={`/admin/orders/${o.id}`}>#{o.id}</Link>{" "}
                            {o.status} · {o.total_amount} ₽ ·{" "}
                            {formatDate(o.created_at)}
                            <div
                              className="muted"
                              style={{ fontSize: "0.8rem" }}
                            >
                              {(o.items || []).map((it) => (
                                <span key={it.id}>
                                  {it.product_name_snapshot} ×{it.quantity}{" "}
                                </span>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <h4 style={{ marginTop: "var(--space-4)" }}>Отзывы</h4>
                    {(userDetail.reviews || []).length === 0 ? (
                      <p className="muted">Нет</p>
                    ) : (
                      <ul style={{ paddingLeft: 18 }}>
                        {userDetail.reviews.map((r) => (
                          <li key={r.id}>
                            <Link
                              to={`/product/${encodeURIComponent(r.product_slug)}?review=${r.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {r.product_name}
                            </Link>{" "}
                            {r.rating}★ ·{" "}
                            {r.status === "deleted"
                              ? "удалён"
                              : r.status === "approved"
                                ? "виден"
                                : "скрыт"}{" "}
                            · {formatDate(r.created_at)}
                            <div className="muted">
                              {(r.body || "").slice(0, 120)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <h4 style={{ marginTop: "var(--space-4)" }}>
                      Ограничения (санкции)
                    </h4>
                    {(userDetail.suspensions || []).length === 0 ? (
                      <p className="muted">Нет записей</p>
                    ) : (
                      <ul style={{ paddingLeft: 18 }}>
                        {userDetail.suspensions.map((s) => (
                          <li key={s.id}>
                            {formatDate(s.created_at)} — {s.reason}
                            <div className="muted">
                              до:{" "}
                              {s.expires_at
                                ? formatDate(s.expires_at)
                                : "бессрочно"}{" "}
                              · админ: {s.admin_email || "—"}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <h4 style={{ marginTop: "var(--space-4)" }}>
                      Жалобы на отзывы пользователя
                    </h4>
                    {(userDetail.reports_on_reviews || []).length === 0 ? (
                      <p className="muted">Нет</p>
                    ) : (
                      <ul style={{ paddingLeft: 18 }}>
                        {userDetail.reports_on_reviews.map((rep) => (
                          <li key={rep.id}>
                            #{rep.id} {rep.status} {rep.reason} · отзыв #
                            {rep.review_id} · {formatDate(rep.created_at)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <div className="modal__footer">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setUserDetail(null);
                    setUserDetailLoading(false);
                  }}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      <ConfirmModal
        open={!!confirm}
        title="Заблокировать пользователя?"
        message={confirm && `Пользователь ${confirm.email} будет заблокирован.`}
        confirmText="Заблокировать"
        onConfirm={doBlock}
        onCancel={() => setConfirm(null)}
      />

      {suspendModal && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setSuspendModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal__header">
                <h3 className="modal__title">Ограничить отзывы</h3>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setSuspendModal(null)}
                >
                  x
                </button>
              </div>
              <div className="modal__body">
                <p>
                  Пользователь: <strong>{suspendModal.email}</strong>
                </p>
                <div className="field">
                  <label>Причина *</label>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 80 }}
                    value={suspendData.reason}
                    onChange={(e) =>
                      setSuspendData((d) => ({ ...d, reason: e.target.value }))
                    }
                    placeholder="Укажите причину ограничения"
                  />
                </div>
                <div className="field">
                  <label>Срок до (оставьте пустым для бессрочного)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={suspendData.expires_at}
                    onChange={(e) =>
                      setSuspendData((d) => ({
                        ...d,
                        expires_at: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="modal__footer">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSuspendModal(null)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={doSuspend}
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
