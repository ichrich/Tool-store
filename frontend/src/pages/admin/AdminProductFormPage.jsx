import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  adminCreateProduct,
  adminFetchBrands,
  adminFetchCategories,
  adminFetchCharacteristics,
  adminFetchProduct,
  adminUpdateProduct,
} from "../../api/adminApi";
import { imgSrc } from "../../utils/format";

export function AdminProductFormPage() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from;
  const [categories, setCategories] = useState([]);
  const [brandData, setBrandData] = useState({ brands: [], models: [] });
  const [characteristicOptions, setCharacteristicOptions] = useState([]);
  const [characteristicRows, setCharacteristicRows] = useState([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [brandModelId, setBrandModelId] = useState("");
  const [modelMode, setModelMode] = useState("existing");
  const [newModelName, setNewModelName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [image, setImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const visibleModels = useMemo(
    () =>
      brandId
        ? brandData.models.filter((m) => String(m.brand_id) === String(brandId))
        : [],
    [brandData.models, brandId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, brands, characteristics] = await Promise.all([
          adminFetchCategories(),
          adminFetchBrands(),
          adminFetchCharacteristics(),
        ]);
        if (!cancelled) {
          setCategories(cats);
          setBrandData(brands);
          setCharacteristicOptions(characteristics);
          if (isNew && cats.length)
            setCategoryId((prev) => prev || String(cats[0].id));
        }
      } catch (e) {
        if (!cancelled)
          setError(e.response?.data?.error || "Ошибка загрузки справочников");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNew]);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await adminFetchProduct(id);
        if (cancelled) return;
        setName(p.name);
        setSlug(p.slug);
        setCategoryId(String(p.category_id));
        setBrandId(p.brand_id ? String(p.brand_id) : "");
        setBrandModelId(p.brand_model_id ? String(p.brand_model_id) : "");
        setDescription(p.description || "");
        setPrice(String(p.price));
        setStock(String(p.stock));
        setCurrentImage(p.image_path);
        setCharacteristicRows(
          (p.characteristics || []).map((item) => ({
            characteristic_id: String(item.characteristic_id),
            characteristic_name: item.characteristic_name,
            value_id: String(item.value_id),
            value: item.value,
          })),
        );
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || "Товар не найден");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew]);

  useEffect(() => {
    if (!image) {
      setImagePreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(image);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const normalizedPrice = Number(price);
    const normalizedStock = Number(stock);
    if (!name.trim()) {
      setError("Укажите название товара");
      return;
    }
    if (!categoryId) {
      setError("Выберите категорию");
      return;
    }
    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      setError("Цена должна быть больше 0");
      return;
    }
    if (
      !Number.isInteger(normalizedStock) ||
      normalizedStock < 0 ||
      normalizedStock > 9999
    ) {
      setError("Остаток должен быть целым числом от 0 до 9999");
      return;
    }
    if (
      image &&
      !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
        image.type,
      )
    ) {
      setError("Можно загрузить только изображение jpg, png, gif или webp");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      if (slug.trim()) fd.append("slug", slug.trim());
      fd.append("category_id", categoryId);
      if (brandId) fd.append("brand_id", brandId);
      if (brandId && modelMode === "new" && newModelName.trim()) {
        fd.append("model_name", newModelName.trim());
      } else if (brandId && brandModelId) {
        fd.append("brand_model_id", brandModelId);
      }
      fd.append("description", description.trim());
      fd.append("price", String(normalizedPrice));
      fd.append("stock", String(normalizedStock));
      fd.append(
        "characteristics",
        JSON.stringify(groupCharacteristicRows(characteristicRows)),
      );
      if (image) fd.append("image", image);

      if (isNew) await adminCreateProduct(fd);
      else await adminUpdateProduct(id, fd);
      navigate(returnTo || "/admin/products");
    } catch (err) {
      setError(err.response?.data?.error || "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Загрузка...</p>;

  const preview = imagePreviewUrl || imgSrc(currentImage);

  return (
    <div>
      <p>
        <Link to={returnTo || "/admin/products"}>
          {returnTo ? "← Вернуться на страницу товара" : "← Товары"}
        </Link>
      </p>
      <h1>{isNew ? "Новый товар" : "Редактирование товара"}</h1>
      {error && <p className="field-error">{error}</p>}
      <form onSubmit={onSubmit} className="card admin-form-card">
        <div className="field">
          <label>Название</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={500}
          />
        </div>
        <div className="field">
          <label>Адрес страницы</label>
          <input
            className="input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={255}
          />
        </div>
        <div className="field">
          <label>Категория</label>
          <select
            className="select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="two-col-responsive">
          <div className="field">
            <label>Бренд</label>
            <select
              className="select"
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setBrandModelId("");
                setNewModelName("");
              }}
            >
              <option value="">Не указан</option>
              {brandData.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          {brandId && (
            <div className="field">
              <label>Тип модели</label>
              <select
                className="select"
                value={modelMode}
                onChange={(e) => {
                  setModelMode(e.target.value);
                  setBrandModelId("");
                  setNewModelName("");
                }}
              >
                <option value="existing">Выбрать существующую</option>
                <option value="new">Создать новую</option>
              </select>
            </div>
          )}
        </div>
        {brandId && modelMode === "existing" && (
          <div className="field">
            <label>Модель бренда</label>
            <select
              className="select"
              value={brandModelId}
              onChange={(e) => setBrandModelId(e.target.value)}
            >
              <option value="">Не указана</option>
              {visibleModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {brandId && modelMode === "new" && (
          <div className="field">
            <label>Новая модель</label>
            <input
              className="input"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="Например, GSR 18V-90 C"
              maxLength={255}
            />
          </div>
        )}
        <div className="field">
          <label>Описание</label>
          <textarea
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            maxLength={10000}
          />
        </div>
        <CharacteristicEditor
          options={characteristicOptions}
          rows={characteristicRows}
          setRows={setCharacteristicRows}
        />
        <div className="two-col-responsive">
          <div className="field">
            <label>Цена</label>
            <input
              className="input"
              type="number"
              min="0.01"
              max="9999999999.99"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Остаток</label>
            <input
              className="input"
              type="number"
              min="0"
              max="9999"
              step="1"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="field">
          <label>Изображение</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
          />
          {preview && (
            <div style={{ marginTop: "0.5rem" }}>
              <img
                src={preview}
                alt=""
                width={200}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                }}
              />
            </div>
          )}
        </div>
        <button type="submit" className="btn btn--primary" disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </form>
    </div>
  );
}

function groupCharacteristicRows(rows) {
  const groups = new Map();

  for (const row of rows) {
    const characteristicKey =
      row.characteristic_id ||
      `new:${row.characteristic_name.trim().toLowerCase()}`;

    if (!row.characteristic_id && !row.characteristic_name.trim()) {
      continue;
    }

    if (!row.value_id && !row.value.trim()) {
      continue;
    }

    if (!groups.has(characteristicKey)) {
      groups.set(characteristicKey, {
        characteristic_id: row.characteristic_id || undefined,
        characteristic_name: row.characteristic_id
          ? undefined
          : row.characteristic_name.trim(),
        values: [],
      });
    }

    groups.get(characteristicKey).values.push({
      value_id: row.value_id || undefined,
      value: row.value_id ? undefined : row.value.trim(),
    });
  }

  return [...groups.values()];
}

function CharacteristicEditor({ options, rows, setRows }) {
  function updateRow(index, patch) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        characteristic_id: "",
        characteristic_name: "",
        value_id: "",
        value: "",
      },
    ]);
  }

  function removeRow(index) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <section className="product-characteristics-editor">
      <div className="product-characteristics-editor__header">
        <div>
          <h2>Характеристики</h2>
          <p>
            Выберите существующую характеристику и значение или создайте новые.
          </p>
        </div>
        <button type="button" className="btn" onClick={addRow}>
          <Plus size={17} />
          Добавить
        </button>
      </div>

      <div className="product-characteristics-editor__rows">
        {rows.map((row, index) => {
          const selectedCharacteristic = options.find(
            (item) => String(item.id) === String(row.characteristic_id),
          );

          return (
            <div className="product-characteristic-row" key={index}>
              <div className="field">
                <label>Характеристика</label>
                <select
                  className="select"
                  value={row.characteristic_id || "__new"}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateRow(index, {
                      characteristic_id: value === "__new" ? "" : value,
                      characteristic_name: "",
                      value_id: "",
                      value: "",
                    });
                  }}
                >
                  <option value="__new">Создать новую</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>

              {!row.characteristic_id && (
                <div className="field">
                  <label>Новое название</label>
                  <input
                    className="input"
                    value={row.characteristic_name}
                    onChange={(event) =>
                      updateRow(index, {
                        characteristic_name: event.target.value,
                      })
                    }
                    maxLength={120}
                  />
                </div>
              )}

              <div className="field">
                <label>Значение</label>
                <select
                  className="select"
                  value={row.value_id || "__new"}
                  disabled={!row.characteristic_id}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateRow(index, {
                      value_id: value === "__new" ? "" : value,
                      value: "",
                    });
                  }}
                >
                  <option value="__new">Создать новое</option>
                  {(selectedCharacteristic?.values || []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </div>

              {(!row.value_id || !row.characteristic_id) && (
                <div className="field">
                  <label>Новое значение</label>
                  <input
                    className="input"
                    value={row.value}
                    onChange={(event) =>
                      updateRow(index, { value: event.target.value })
                    }
                    maxLength={160}
                  />
                </div>
              )}

              <button
                type="button"
                className="btn btn--danger product-characteristic-row__remove"
                onClick={() => removeRow(index)}
                aria-label="Удалить характеристику"
              >
                <Trash2 size={17} />
              </button>
            </div>
          );
        })}
      </div>

      {rows.length === 0 && (
        <p className="muted">У товара пока нет характеристик.</p>
      )}
    </section>
  );
}
