import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  adminCreateArticle,
  adminFetchArticle,
  adminFetchProducts,
  adminUpdateArticle,
  adminUploadFile,
} from "../../api/adminApi";
import { imgSrc } from "../../utils/format";

let blockKey = 1;
function nextKey() {
  blockKey += 1;
  return blockKey;
}

export function AdminArticleFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [slug, setSlug] = useState("");
  const [published, setPublished] = useState(false);
  const [blocks, setBlocks] = useState(() => [
    { key: nextKey(), block_type: "text", body: "" },
    { key: nextKey(), block_type: "text", body: "" },
  ]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    adminFetchProducts({ page: 1, limit: 200 })
      .then((d) => setProducts(d.items || []))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const row = await adminFetchArticle(id);
        if (cancelled) return;
        setTitle(row.title);
        setAuthorName(row.author_name || "");
        setSlug(row.slug);
        setPublished(Boolean(row.published));
        setBlocks(
          (row.blocks || []).map((b) => ({
            key: nextKey(),
            block_type: b.block_type,
            body: b.body || "",
            product_id: b.product_id || "",
          })),
        );
      } catch (e) {
        if (!cancelled)
          setError(e.response?.data?.error || "Статья не найдена");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  function addText() {
    setBlocks((prev) => [
      ...prev,
      { key: nextKey(), block_type: "text", body: "" },
    ]);
  }

  function addProduct() {
    setBlocks((prev) => [
      ...prev,
      { key: nextKey(), block_type: "product", body: "" },
    ]);
  }

  async function addImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const { url } = await adminUploadFile(file);
        setBlocks((prev) => [
          ...prev,
          { key: nextKey(), block_type: "image", body: url },
        ]);
      } catch (e) {
        setError(e.response?.data?.error || "Не удалось загрузить файл");
      }
    };
    input.click();
  }

  function updateBlock(key, patch) {
    setBlocks((prev) =>
      prev.map((b) => (b.key === key ? { ...b, ...patch } : b)),
    );
  }

  function removeBlock(key) {
    setBlocks((prev) => prev.filter((b) => b.key !== key));
  }

  function moveBlock(key, direction) {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.key === key);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const payloadBlocks = blocks.map((b) => ({
      block_type: b.block_type,
      body: b.body,
      product_id:
        b.block_type === "product" ? Number(b.product_id || b.body) : undefined,
    }));
    if (payloadBlocks.length === 0) {
      setError("Добавьте хотя бы один блок");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title,
        author_name: authorName || undefined,
        slug: slug || undefined,
        published,
        blocks: payloadBlocks,
      };
      if (isNew) {
        await adminCreateArticle(body);
      } else {
        await adminUpdateArticle(id, body);
      }
      navigate("/admin/articles");
    } catch (err) {
      setError(err.response?.data?.error || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Загрузка…</p>;

  return (
    <div>
      <p>
        <Link to="/admin/articles">← Статьи</Link>
      </p>
      <h1>{isNew ? "Новая статья" : "Редактирование статьи"}</h1>
      {error && <p className="field-error">{error}</p>}
      <form onSubmit={onSubmit} className="card" style={{ padding: "1rem" }}>
        <div className="field">
          <label>Заголовок</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>
            Адрес страницы (необязательно — генерируется на сервере)
          </label>
          <input
            className="input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Автор статьи</label>
          <input
            className="input"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Имя Фамилия"
          />
        </div>

        <h2 style={{ fontSize: "1rem" }}>Блоки</h2>
        <p className="muted">
          Текстовые блоки и изображения в заданном порядке.
        </p>

        <div className="stack">
          {blocks.map((b, index) => (
            <div key={b.key} className="card" style={{ padding: "0.75rem" }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="badge">
                  {index + 1}.{" "}
                  {b.block_type === "text"
                    ? "Текст"
                    : b.block_type === "image"
                      ? "Изображение"
                      : "Товар"}
                </span>
                <div className="row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={index === 0}
                    onClick={() => moveBlock(b.key, -1)}
                  >
                    Выше
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={index === blocks.length - 1}
                    onClick={() => moveBlock(b.key, 1)}
                  >
                    Ниже
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={() => removeBlock(b.key)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
              {b.block_type === "text" ? (
                <textarea
                  className="textarea"
                  style={{ marginTop: "0.5rem" }}
                  rows={4}
                  value={b.body}
                  onChange={(e) => updateBlock(b.key, { body: e.target.value })}
                />
              ) : b.block_type === "image" ? (
                <div style={{ marginTop: "0.5rem" }}>
                  <input
                    className="input"
                    value={b.product_id || b.body}
                    onChange={(e) =>
                      updateBlock(b.key, {
                        product_id: e.target.value,
                        body: "",
                      })
                    }
                    placeholder="/uploads/..."
                  />
                  {imgSrc(b.body) && (
                    <img
                      src={imgSrc(b.body)}
                      alt=""
                      width={240}
                      style={{
                        marginTop: "0.5rem",
                        border: "2px solid var(--color-brown)",
                      }}
                    />
                  )}
                  <div style={{ marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = async () => {
                          const file = input.files?.[0];
                          if (!file) return;
                          try {
                            const { url } = await adminUploadFile(file);
                            updateBlock(b.key, { body: url });
                          } catch (err) {
                            setError(
                              err.response?.data?.error ||
                                "Загрузка не удалась",
                            );
                          }
                        };
                        input.click();
                      }}
                    >
                      Заменить файл
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: "0.5rem" }}>
                  <input
                    className="input"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Поиск товара по названию"
                    style={{ marginBottom: 8 }}
                  />
                  <select
                    className="select"
                    value={b.body}
                    onChange={(e) =>
                      updateBlock(b.key, { body: e.target.value })
                    }
                  >
                    <option value="">Выберите товар</option>
                    {products
                      .filter((p) =>
                        p.name
                          .toLowerCase()
                          .includes(productSearch.trim().toLowerCase()),
                      )
                      .map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="row" style={{ marginTop: "1rem" }}>
          <button type="button" className="btn" onClick={addText}>
            + Текстовый блок
          </button>
          <button type="button" className="btn" onClick={addImage}>
            + Изображение
          </button>
          <button type="button" className="btn" onClick={addProduct}>
            + Товар
          </button>
        </div>

        <div
          className="row"
          style={{
            marginTop: "1.5rem",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />{" "}
            Опубликовано
          </label>
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}
