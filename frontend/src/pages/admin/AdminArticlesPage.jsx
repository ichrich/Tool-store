import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { adminDeleteArticle, adminFetchArticles } from "../../api/adminApi";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useToast } from "../../context/ToastContext";

export function AdminArticlesPage() {
  const navigate = useNavigate();
  const { error: showError } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetchArticles();
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e.userMessage || e.response?.data?.error || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function doDelete() {
    if (!confirmId) return;
    try {
      await adminDeleteArticle(confirmId);
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(
        err.userMessage || err.response?.data?.error || "Не удалось удалить",
      );
      showError(err.userMessage || "Не удалось удалить статью");
      setConfirmId(null);
    }
  }

  return (
    <div>
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: "1rem" }}
      >
        <h1 style={{ margin: 0 }}>Статьи</h1>
        <Link className="btn btn--primary" to="/admin/articles/new">
          <Plus size={17} />
          Новая статья
        </Link>
      </div>
      {loading && <p>Загрузка…</p>}
      {error && <p className="field-error">{error}</p>}
      <div className="field" style={{ maxWidth: 360 }}>
        <label>Поиск</label>
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Заголовок или адрес страницы"
        />
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Заголовок</th>
              <th>Адрес</th>
              <th>Опубликовано</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((a) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                return (
                  String(a.title).toLowerCase().includes(q) ||
                  String(a.slug).toLowerCase().includes(q)
                );
              })
              .map((a) => (
                <tr
                  key={a.id}
                  className="admin-clickable-row"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/admin/articles/${a.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter")
                      navigate(`/admin/articles/${a.id}`);
                  }}
                >
                  <td>{a.id}</td>
                  <td>{a.title}</td>
                  <td>{a.slug}</td>
                  <td>{a.published ? "Да" : "Нет"}</td>
                  <td>
                    <div className="admin-action-stack">
                      <Link
                        className="btn btn--icon"
                        to={`/blog/${a.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Открыть на сайте"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <ExternalLink size={17} />
                      </Link>
                      <Link
                        className="btn btn--icon"
                        to={`/admin/articles/${a.id}`}
                        title="Редактировать"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Pencil size={17} />
                      </Link>
                      <button
                        type="button"
                        className="btn btn--icon btn--danger"
                        title="Удалить"
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirmId(a.id);
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={confirmId != null}
        title="Удалить статью?"
        message="Статья будет удалена без возможности восстановления."
        confirmText="Удалить"
        onConfirm={doDelete}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}
