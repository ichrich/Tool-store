import { useEffect, useState } from "react";
import { adminFetchAppeals, adminResolveAppeal } from "../../api/adminApi";
import { useToast } from "../../context/ToastContext";
import { ModalPortal } from "../../components/ModalPortal";
import { formatDate, imgSrc } from "../../utils/format";

const STATUS_LABELS = {
  pending: "На рассмотрении",
  approved: "Одобрена",
  rejected: "Отклонена",
};

const PAYMENT_LABELS = {
  cash: "Наличными при получении",
  yookassa: "ЮKassa",
};

export function AdminAppealsPage() {
  const { success, error: showError } = useToast();
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveForm, setResolveForm] = useState({ admin_note: "" });

  async function load() {
    setLoading(true);
    try {
      setRows(await adminFetchAppeals({ status }));
    } catch (e) {
      showError(e.userMessage || "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  async function resolve() {
    const row = resolveModal?.row;
    const nextStatus = resolveModal?.status;
    if (!row || !nextStatus) return;
    const admin_note = resolveForm.admin_note.trim();
    const orderPatch =
      row.request_type === "cancel_order"
        ? {
            customer_name: row.customer_name,
            customer_email: row.customer_email,
            customer_phone: row.customer_phone,
            address: row.address,
            delivery_time: row.delivery_time,
            notes: row.notes,
            admin_note,
          }
        : undefined;
    try {
      await adminResolveAppeal(row.request_key || row.id, {
        status: nextStatus,
        admin_note,
        order: orderPatch,
      });
      success(
        nextStatus === "approved" ? "Заявка одобрена" : "Заявка отклонена",
      );
      setResolveModal(null);
      setResolveForm({ admin_note: "" });
      await load();
    } catch (e) {
      showError(e.userMessage || "Не удалось обработать заявку");
    }
  }

  function openResolve(row, nextStatus) {
    setResolveModal({ row, status: nextStatus });
    setResolveForm({
      admin_note: row.admin_note || "",
    });
  }

  function updateRow(key, patch) {
    setRows((prev) =>
      prev.map((row) => (row.request_key === key ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div>
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          marginBottom: "var(--space-5)",
        }}
      >
        <h1 style={{ margin: 0 }}>Заявки</h1>
        <select
          className="select"
          style={{ maxWidth: 220 }}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="pending">На рассмотрении</option>
          <option value="approved">Одобрены</option>
          <option value="rejected">Отклонены</option>
          <option value="all">Все</option>
        </select>
      </div>

      {loading ? (
        <div className="page-loading">
          <div className="spinner spinner--lg" />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Тип</th>
                <th>Пользователь</th>
                <th>Сообщение</th>
                <th>Данные</th>
                <th>Статус</th>
                <th>Дата</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.request_key || a.id}>
                  <td>{a.id}</td>
                  <td>{a.request_type_label || "Разблокировка"}</td>
                  <td>
                    <strong>{a.email}</strong>
                    <div className="muted">
                      {[a.first_name, a.last_name].filter(Boolean).join(" ")}
                    </div>
                  </td>
                  <td style={{ maxWidth: 360, whiteSpace: "pre-wrap" }}>
                    {a.message}
                  </td>
                  <td>
                    {a.request_type === "cancel_order" ? (
                      <div className="stack" style={{ gap: 8, minWidth: 260 }}>
                        <div className="muted">
                          Заказ #{a.order_id},{" "}
                          {PAYMENT_LABELS[a.payment_method] || a.payment_method}
                        </div>
                        <input
                          className="input"
                          value={a.customer_name || ""}
                          onChange={(e) =>
                            updateRow(a.request_key, {
                              customer_name: e.target.value,
                            })
                          }
                          placeholder="Имя клиента"
                        />
                        <input
                          className="input"
                          value={a.customer_email || ""}
                          onChange={(e) =>
                            updateRow(a.request_key, {
                              customer_email: e.target.value,
                            })
                          }
                          placeholder="Email"
                        />
                        <input
                          className="input"
                          value={a.customer_phone || ""}
                          onChange={(e) =>
                            updateRow(a.request_key, {
                              customer_phone: e.target.value,
                            })
                          }
                          placeholder="Телефон"
                        />
                        <textarea
                          className="textarea"
                          rows={2}
                          value={a.address || ""}
                          onChange={(e) =>
                            updateRow(a.request_key, {
                              address: e.target.value,
                            })
                          }
                          placeholder="Адрес"
                        />
                      </div>
                    ) : a.screenshot_path ? (
                      <a
                        href={imgSrc(a.screenshot_path)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Открыть скриншот
                      </a>
                    ) : (
                      <span className="muted">Нет вложений</span>
                    )}
                  </td>
                  <td>
                    <span className="badge">
                      {STATUS_LABELS[a.status] || a.status}
                    </span>
                  </td>
                  <td>{formatDate(a.created_at)}</td>
                  <td>
                    {a.status === "pending" && (
                      <div className="admin-action-stack">
                        <button
                          className="btn btn--sm"
                          onClick={() => openResolve(a, "approved")}
                        >
                          Одобрить
                        </button>
                        <button
                          className="btn btn--sm btn--danger"
                          onClick={() => openResolve(a, "rejected")}
                        >
                          Отклонить
                        </button>
                      </div>
                    )}
                    {a.status !== "pending" && (
                      <div
                        className="muted"
                        style={{ maxWidth: 220, whiteSpace: "pre-wrap" }}
                      >
                        {a.admin_note || "Решение принято"}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resolveModal && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setResolveModal(null)}>
            <div
              className="modal"
              style={{ maxWidth: 720 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal__header">
                <div>
                  <div className="modal__icon">
                    {resolveModal.status === "approved" ? "✓" : "!"}
                  </div>
                  <h3 className="modal__title">
                    {resolveModal.status === "approved"
                      ? "Одобрить заявку"
                      : "Отклонить заявку"}
                  </h3>
                </div>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setResolveModal(null)}
                  aria-label="Закрыть"
                >
                  x
                </button>
              </div>
              <div className="modal__body">
                <div
                  className="alert alert--info"
                  style={{ marginBottom: "var(--space-4)" }}
                >
                  {resolveModal.row.subject ||
                    resolveModal.row.request_type_label}
                </div>

                {resolveModal.row.request_type === "cancel_order" && (
                  <div
                    className="profile-two-col"
                    style={{ marginBottom: "var(--space-4)" }}
                  >
                    <div className="field">
                      <label>Имя клиента</label>
                      <input
                        className="input"
                        value={resolveModal.row.customer_name || ""}
                        onChange={(e) =>
                          updateRow(resolveModal.row.request_key, {
                            customer_name: e.target.value,
                          }) ||
                          setResolveModal((m) => ({
                            ...m,
                            row: { ...m.row, customer_name: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Email</label>
                      <input
                        className="input"
                        value={resolveModal.row.customer_email || ""}
                        onChange={(e) =>
                          updateRow(resolveModal.row.request_key, {
                            customer_email: e.target.value,
                          }) ||
                          setResolveModal((m) => ({
                            ...m,
                            row: { ...m.row, customer_email: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Телефон</label>
                      <input
                        className="input"
                        value={resolveModal.row.customer_phone || ""}
                        onChange={(e) =>
                          updateRow(resolveModal.row.request_key, {
                            customer_phone: e.target.value,
                          }) ||
                          setResolveModal((m) => ({
                            ...m,
                            row: { ...m.row, customer_phone: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Адрес</label>
                      <textarea
                        className="textarea"
                        rows={3}
                        value={resolveModal.row.address || ""}
                        onChange={(e) =>
                          updateRow(resolveModal.row.request_key, {
                            address: e.target.value,
                          }) ||
                          setResolveModal((m) => ({
                            ...m,
                            row: { ...m.row, address: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="field">
                  <label>
                    {resolveModal.status === "approved"
                      ? "Комментарий к решению"
                      : "Причина отклонения"}
                  </label>
                  <textarea
                    className="textarea"
                    rows={4}
                    value={resolveForm.admin_note}
                    onChange={(e) =>
                      setResolveForm((f) => ({
                        ...f,
                        admin_note: e.target.value,
                      }))
                    }
                    placeholder={
                      resolveModal.status === "approved"
                        ? "Комментарий увидит пользователь"
                        : "Напишите, почему заявка отклонена"
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
                  className={`btn ${resolveModal.status === "approved" ? "btn--primary" : "btn--danger"}`}
                  onClick={resolve}
                >
                  {resolveModal.status === "approved"
                    ? "Одобрить"
                    : "Отклонить"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
