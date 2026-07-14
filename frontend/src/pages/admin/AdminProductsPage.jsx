import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { adminDeleteProduct, adminFetchProducts } from "../../api/adminApi";
import { formatPrice, imgSrc } from "../../utils/format";
import { ConfirmModal } from "../../components/ConfirmModal";
import { SafeImage } from "../../components/SafeImage";

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

export function AdminProductsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [sort, setSort] = useState("id");
  const [order, setOrder] = useState("desc");
  const [search, setSearch] = useState("");

  const toggleSort = useCallback((field) => {
    setSort((prev) => {
      if (prev === field) {
        setOrder((o) => (o === "asc" ? "desc" : "asc"));
        return prev;
      }
      setOrder("desc");
      return field;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetchProducts({
        limit: 100,
        page: 1,
        sort,
        order,
        search: search || undefined,
      });
      setData(res);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.error || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [sort, order, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function doDeleteProduct() {
    if (!confirmDeleteId) return;
    try {
      await adminDeleteProduct(confirmDeleteId);
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Не удалось удалить");
      setConfirmDeleteId(null);
    }
  }

  return (
    <div>
      <div
        className="row"
        style={{ justifyContent: "space-between", marginBottom: "1rem" }}
      >
        <h1 style={{ margin: 0 }}>Товары</h1>
        <Link className="btn btn--primary" to="/admin/products/new">
          <Plus size={17} />
          Новый товар
        </Link>
      </div>
      <div className="field" style={{ maxWidth: 360 }}>
        <label>Поиск</label>
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Название, описание"
        />
      </div>
      {loading && <p>Загрузка…</p>}
      {error && <p className="field-error">{error}</p>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Фото</th>
              <SortTh
                field="name"
                label="Название"
                sort={sort}
                order={order}
                onToggle={toggleSort}
              />
              <th>Категория</th>
              <SortTh
                field="price"
                label="Цена"
                sort={sort}
                order={order}
                onToggle={toggleSort}
              />
              <SortTh
                field="stock"
                label="Остаток"
                sort={sort}
                order={order}
                onToggle={toggleSort}
              />
              <SortTh
                field="created_at"
                label="Дата"
                sort={sort}
                order={order}
                onToggle={toggleSort}
              />
              <th />
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => {
              const src = imgSrc(p.image_path);
              return (
                <tr
                  key={p.id}
                  className="admin-clickable-row"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/admin/products/${p.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter")
                      navigate(`/admin/products/${p.id}`);
                  }}
                >
                  <td>
                    <SafeImage
                      src={src}
                      alt={p.name}
                      width={48}
                      height={48}
                      className="admin-product-thumbnail"
                    />
                  </td>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td>
                    <Link
                      to={`/catalog?category=${encodeURIComponent(p.category_slug)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.category_name}
                    </Link>
                  </td>
                  <td>{formatPrice(p.price)}</td>
                  <td>{p.stock}</td>
                  <td
                    className="muted"
                    style={{ whiteSpace: "nowrap", fontSize: "0.8rem" }}
                  >
                    {p.created_at
                      ? new Date(p.created_at).toLocaleDateString("ru-RU")
                      : "—"}
                  </td>
                  <td>
                    <div className="admin-action-stack">
                      <Link
                        className="btn btn--icon"
                        to={`/product/${p.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Открыть на сайте"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <ExternalLink size={17} />
                      </Link>
                      <Link
                        className="btn btn--icon"
                        to={`/admin/products/${p.id}`}
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
                          setConfirmDeleteId(p.id);
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted">Всего: {data.total}</p>

      <ConfirmModal
        open={confirmDeleteId != null}
        title="Удалить товар?"
        message="Товар будет помечен как удалённый и скрыт из каталога."
        confirmText="Удалить"
        onConfirm={doDeleteProduct}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
