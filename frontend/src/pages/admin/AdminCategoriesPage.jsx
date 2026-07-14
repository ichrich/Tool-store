import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminFetchCategories,
  adminUpdateCategory,
} from "../../api/adminApi";
import { ConfirmModal } from "../../components/ConfirmModal";

export function AdminCategoriesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [recommendedIds, setRecommendedIds] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editRecommendedIds, setEditRecommendedIds] = useState([]);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetchCategories();
      setRows(data);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    setError(null);
    try {
      await adminCreateCategory({
        name,
        slug: slug || undefined,
        recommended_category_ids: recommendedIds,
      });
      setName("");
      setSlug("");
      setRecommendedIds([]);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Не удалось создать");
    }
  }

  function startEdit(c) {
    setEditId(c.id);
    setEditName(c.name);
    setEditSlug(c.slug);
    setEditRecommendedIds(
      (c.recommended_categories || []).map((item) => item.id),
    );
  }

  async function saveEdit() {
    if (!editId) return;
    setError(null);
    try {
      await adminUpdateCategory(editId, {
        name: editName,
        slug: editSlug || undefined,
        recommended_category_ids: editRecommendedIds,
      });
      setEditId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Не удалось сохранить");
    }
  }

  async function doDeleteCategory() {
    if (!confirmDeleteId) return;
    try {
      await adminDeleteCategory(confirmDeleteId);
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Не удалось удалить");
      setConfirmDeleteId(null);
    }
  }

  function toggleRecommended(id, mode) {
    const setValue =
      mode === "edit" ? setEditRecommendedIds : setRecommendedIds;
    setValue((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function RecommendedPicker({ value, mode, excludeId }) {
    const available = rows.filter((category) => category.id !== excludeId);
    if (available.length === 0) {
      return <p className="muted">Сначала создайте еще одну категорию.</p>;
    }
    return (
      <div className="category-recommendation-picker">
        {available.map((category) => (
          <label key={category.id} className="check-row">
            <input
              type="checkbox"
              checked={value.includes(category.id)}
              onChange={() => toggleRecommended(category.id, mode)}
            />
            <span>{category.name}</span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h1>Категории</h1>
      {loading && <p>Загрузка…</p>}
      {error && <p className="field-error">{error}</p>}

      <div className="field" style={{ maxWidth: 360 }}>
        <label>Поиск</label>
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Название или адрес страницы"
        />
      </div>

      <form
        onSubmit={onCreate}
        className="card"
        style={{ padding: "1rem", marginBottom: "1rem" }}
      >
        <h2 style={{ fontSize: "1rem" }}>Новая категория</h2>
        <div className="field">
          <label>Название</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Адрес страницы (необязательно, иначе из названия)</label>
          <input
            className="input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Рекомендованные категории</label>
          <RecommendedPicker value={recommendedIds} mode="create" />
        </div>
        <button type="submit" className="btn btn--primary">
          Создать
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Название</th>
              <th>Адрес страницы</th>
              <th>Рекомендации</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((c) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                return (
                  String(c.name).toLowerCase().includes(q) ||
                  String(c.slug).toLowerCase().includes(q)
                );
              })
              .map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>
                    {editId === c.id ? (
                      <input
                        className="input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      <Link
                        to={`/catalog?category=${encodeURIComponent(c.slug)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {c.name}
                      </Link>
                    )}
                  </td>
                  <td>
                    {editId === c.id ? (
                      <input
                        className="input"
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value)}
                      />
                    ) : (
                      c.slug
                    )}
                  </td>
                  <td className="admin-text-cell">
                    {editId === c.id ? (
                      <RecommendedPicker
                        value={editRecommendedIds}
                        mode="edit"
                        excludeId={c.id}
                      />
                    ) : (c.recommended_categories || []).length > 0 ? (
                      c.recommended_categories
                        .map((item) => item.name)
                        .join(", ")
                    ) : (
                      <span className="muted">Не выбраны</span>
                    )}
                  </td>
                  <td>
                    {editId === c.id ? (
                      <div className="row">
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={saveEdit}
                        >
                          Сохранить
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            setEditId(null);
                          }}
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => startEdit(c)}
                        >
                          Редактировать
                        </button>{" "}
                        <button
                          type="button"
                          className="btn btn--danger"
                          onClick={() => setConfirmDeleteId(c.id)}
                        >
                          Удалить
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={confirmDeleteId != null}
        title="Удалить категорию?"
        message="Категорию можно удалить только если в ней нет товаров."
        confirmText="Удалить"
        onConfirm={doDeleteCategory}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
