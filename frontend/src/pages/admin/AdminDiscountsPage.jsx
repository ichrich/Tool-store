import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  PackagePlus,
  Percent,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import {
  adminCreateDiscount,
  adminDeleteDiscount,
  adminFetchCategories,
  adminFetchDiscounts,
  adminFetchProducts,
  adminUpdateDiscount,
} from "../../api/adminApi";
import { ConfirmModal } from "../../components/ConfirmModal";
import { DiscountFormField } from "../../components/DiscountFormField";
import { useToast } from "../../context/ToastContext";
import { formatDate, formatPrice } from "../../utils/format";

const EMPTY_DISCOUNT = {
  code: "",
  type: "percent",
  value: "",
  scope: "global",
  scope_id: "",
  product_ids: [],
  min_order_amount: "",
  max_uses: "",
  starts_at: "",
  expires_at: "",
  is_active: true,
};

const SCOPE_LABELS = {
  global: "Все товары",
  category: "Категория",
  product: "Выбранные товары",
  user: "Пользователь",
};

function toDateTimeLocal(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AdminDiscountsPage() {
  const { success, error: showError } = useToast();

  const [discounts, setDiscounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  async function load() {
    setLoading(true);

    try {
      const [discountRows, categoryRows, productRows] = await Promise.all([
        adminFetchDiscounts(),
        adminFetchCategories(),
        adminFetchProducts({
          page: 1,
          limit: 200,
        }),
      ]);

      setDiscounts(discountRows);
      setCategories(categoryRows);
      setProducts(productRows.items || []);
    } catch (error) {
      showError(error.userMessage || "Не удалось загрузить промокоды");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openForm(discount = EMPTY_DISCOUNT) {
    setProductSearch("");

    setForm({
      ...discount,
      scope: discount.scope || "global",
      scope_id: discount.scope_id == null ? "" : String(discount.scope_id),
      product_ids: (discount.product_ids || []).map(Number),
      starts_at: toDateTimeLocal(discount.starts_at),
      expires_at: toDateTimeLocal(discount.expires_at),
    });
  }

  async function save(event) {
    event.preventDefault();

    const code = String(form.code || "").trim();
    const value = Number(form.value);

    if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) {
      showError("Укажите корректный код промокода");
      return;
    }

    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      (form.type === "percent" && value > 100)
    ) {
      showError("Проверьте размер скидки");
      return;
    }

    if (form.scope === "category" && !Number(form.scope_id)) {
      showError("Выберите категорию");
      return;
    }

    if (form.scope === "product" && !form.product_ids.length) {
      showError("Выберите хотя бы один товар");
      return;
    }

    if (form.scope === "user" && !Number(form.scope_id)) {
      showError("Укажите идентификатор пользователя");
      return;
    }

    if (
      form.starts_at &&
      form.expires_at &&
      new Date(form.starts_at) > new Date(form.expires_at)
    ) {
      showError("Дата начала не может быть позже даты окончания");
      return;
    }

    const payload = {
      ...form,
      code: code.toUpperCase(),
      value,
      scope_id: ["category", "user"].includes(form.scope)
        ? Number(form.scope_id)
        : "",
      product_ids: form.scope === "product" ? form.product_ids : [],
      min_order_amount:
        form.min_order_amount === "" ? "" : Number(form.min_order_amount),
      max_uses: form.max_uses === "" ? "" : Number(form.max_uses),
    };

    try {
      if (form.id) {
        await adminUpdateDiscount(form.id, payload);
      } else {
        await adminCreateDiscount(payload);
      }

      success(form.id ? "Промокод обновлён" : "Промокод создан");

      setForm(null);
      await load();
    } catch (error) {
      showError(error.userMessage || "Не удалось сохранить промокод");
    }
  }

  async function remove() {
    try {
      await adminDeleteDiscount(confirm.id);

      setConfirm(null);
      success("Промокод удалён");

      await load();
    } catch (error) {
      setConfirm(null);
      showError(error.userMessage || "Не удалось удалить промокод");
    }
  }

  const normalizedSearch = search.trim().toLowerCase();

  const visible = discounts.filter((discount) => {
    const searchableText = [
      discount.code,
      SCOPE_LABELS[discount.scope],
      discount.scope_category_name,
      ...(discount.product_names || []),
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearch);
  });

  const foundProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    return products
      .filter((product) => {
        const isSelected = form?.product_ids?.includes(product.id);
        const matchesSearch =
          !query || product.name.toLowerCase().includes(query);

        return !isSelected && matchesSearch;
      })
      .slice(0, 12);
  }, [products, productSearch, form?.product_ids]);

  if (form) {
    return (
      <DiscountEditor
        form={form}
        setForm={setForm}
        categories={categories}
        products={products}
        foundProducts={foundProducts}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        onSave={save}
        onClose={() => setForm(null)}
      />
    );
  }

  return (
    <div className="promotions-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Управление продажами</span>

          <h1>Промокоды</h1>

          <p>
            Создавайте скидки и точно выбирайте товары, на которые они
            действуют.
          </p>
        </div>

        <button className="btn btn--primary" onClick={() => openForm()}>
          <Plus size={18} />
          Создать промокод
        </button>
      </div>

      <div className="promotions-toolbar">
        <label>
          <Search size={17} />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Код, категория или товар"
          />
        </label>

        <span>
          {visible.length} {visible.length === 1 ? "промокод" : "промокодов"}
        </span>
      </div>

      {loading ? (
        <div className="page-loading">
          <span className="spinner spinner--lg" />
        </div>
      ) : (
        <div className="promotion-grid">
          {visible.map((discount) => (
            <article key={discount.id} className="promotion-card">
              <div className="promotion-card__head">
                <div className="promotion-code">
                  <Tag size={17} />
                  <code>{discount.code}</code>
                </div>

                <span
                  className={`badge badge--${
                    discount.is_active ? "completed" : "cancelled"
                  }`}
                >
                  {discount.is_active ? "Активен" : "Отключён"}
                </span>
              </div>

              <strong className="promotion-value">
                {discount.type === "percent"
                  ? `${discount.value}%`
                  : formatPrice(discount.value)}
              </strong>

              <span className="promotion-scope">
                {SCOPE_LABELS[discount.scope]}

                {discount.scope_category_name
                  ? `: ${discount.scope_category_name}`
                  : ""}
              </span>

              {discount.product_names?.length > 0 && (
                <div className="promotion-tags">
                  {discount.product_names.slice(0, 3).map((name) => (
                    <span key={name}>{name}</span>
                  ))}

                  {discount.product_names.length > 3 && (
                    <span>+{discount.product_names.length - 3}</span>
                  )}
                </div>
              )}

              <dl>
                <div>
                  <dt>Использовано</dt>

                  <dd>
                    {discount.uses_count}

                    {discount.max_uses ? ` из ${discount.max_uses}` : ""}
                  </dd>
                </div>

                <div>
                  <dt>Действует до</dt>

                  <dd>
                    {discount.expires_at
                      ? formatDate(discount.expires_at)
                      : "Без ограничения"}
                  </dd>
                </div>
              </dl>

              <div className="promotion-card__actions">
                <button className="btn" onClick={() => openForm(discount)}>
                  Изменить
                </button>

                <button
                  className="btn btn--danger"
                  aria-label={`Удалить ${discount.code}`}
                  onClick={() => setConfirm(discount)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="empty-state">
          <Tag size={40} />

          <div className="empty-state__title">Промокоды не найдены</div>

          <p>Измените запрос или создайте новый промокод.</p>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirm)}
        title="Удалить промокод?"
        message={confirm ? `Промокод «${confirm.code}» будет удалён.` : ""}
        confirmText="Удалить"
        onConfirm={remove}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function DiscountEditor({
  form,
  setForm,
  categories,
  products,
  foundProducts,
  productSearch,
  setProductSearch,
  onSave,
  onClose,
}) {
  const selectedProducts = products.filter((product) =>
    form.product_ids.includes(product.id),
  );

  function updateScope(scope) {
    setForm((current) => ({
      ...current,
      scope,
      scope_id: "",
      product_ids: [],
    }));
  }

  function addProduct(productId) {
    setForm((current) => ({
      ...current,
      product_ids: [...current.product_ids, productId],
    }));

    setProductSearch("");
  }

  function removeProduct(productId) {
    setForm((current) => ({
      ...current,
      product_ids: current.product_ids.filter((id) => id !== productId),
    }));
  }

  return (
    <form className="promotion-editor" onSubmit={onSave}>
      <div className="admin-page-heading">
        <div>
          <button type="button" className="back-link" onClick={onClose}>
            <ChevronLeft size={18} />К списку промокодов
          </button>

          <h1>{form.id ? "Редактирование промокода" : "Новый промокод"}</h1>
        </div>

        <div className="promotion-editor__actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>

          <button type="submit" className="btn btn--primary">
            <Check size={17} />
            Сохранить
          </button>
        </div>
      </div>

      <section className="promotion-editor__section">
        <div className="promotion-editor__section-title">
          <Tag size={20} />

          <div>
            <h2>Основные условия</h2>
            <p>Код, размер скидки и период действия.</p>
          </div>
        </div>

        <div className="promotion-fields promotion-fields--main">
          <DiscountFormField
            label="Код промокода"
            name="code"
            required
            form={form}
            setForm={setForm}
            maxLength={50}
          />

          <div className="field">
            <label>Тип скидки</label>

            <select
              className="select"
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
            >
              <option value="percent">Процент</option>

              <option value="fixed">Сумма в рублях</option>
            </select>
          </div>

          <DiscountFormField
            label="Размер скидки"
            name="value"
            type="number"
            required
            form={form}
            setForm={setForm}
            min="0.01"
            max={form.type === "percent" ? "100" : "9999999999.99"}
            step="0.01"
          />

          <DiscountFormField
            label="Минимальная сумма"
            name="min_order_amount"
            type="number"
            form={form}
            setForm={setForm}
            min="0"
            step="0.01"
          />
        </div>

        <div className="promotion-fields">
          <DiscountFormField
            label="Начало действия"
            name="starts_at"
            type="datetime-local"
            form={form}
            setForm={setForm}
          />

          <DiscountFormField
            label="Окончание"
            name="expires_at"
            type="datetime-local"
            form={form}
            setForm={setForm}
          />

          <DiscountFormField
            label="Лимит использований"
            name="max_uses"
            type="number"
            form={form}
            setForm={setForm}
            min="1"
            step="1"
          />

          <label className="toggle-field">
            <input
              type="checkbox"
              checked={Boolean(form.is_active)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  is_active: event.target.checked,
                }))
              }
            />

            <span>Промокод активен</span>
          </label>
        </div>
      </section>

      <section className="promotion-editor__section">
        <div className="promotion-editor__section-title">
          <Percent size={20} />

          <div>
            <h2>Сфера действия</h2>
            <p>Выберите, к чему применяется скидка.</p>
          </div>
        </div>

        <div className="scope-segment">
          {Object.entries(SCOPE_LABELS).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={form.scope === value ? "active" : ""}
              onClick={() => updateScope(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {form.scope === "category" && (
          <div className="scope-picker">
            <label>
              Категория
              <select
                className="select"
                value={form.scope_id}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scope_id: event.target.value,
                  }))
                }
              >
                <option value="">Выберите категорию</option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {form.scope === "user" && (
          <div className="scope-picker">
            <DiscountFormField
              label="Идентификатор пользователя"
              name="scope_id"
              type="number"
              min="1"
              form={form}
              setForm={setForm}
            />
          </div>
        )}

        {form.scope === "product" && (
          <div className="product-scope-picker">
            <div className="product-search">
              <Search size={17} />

              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Найти товар"
              />
            </div>

            {productSearch && (
              <div className="product-search-results">
                {foundProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => addProduct(product.id)}
                  >
                    <PackagePlus size={16} />

                    <span>{product.name}</span>

                    <small>{formatPrice(product.price)}</small>
                  </button>
                ))}
              </div>
            )}

            <div className="selected-products">
              {selectedProducts.map((product) => (
                <span key={product.id}>
                  <p>{product.name}</p>

                  <button
                    type="button"
                    aria-label={`Убрать ${product.name}`}
                    onClick={() => removeProduct(product.id)}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>

            {!selectedProducts.length && (
              <p className="muted">Добавьте товары через поиск выше.</p>
            )}
          </div>
        )}
      </section>

      <div className="promotion-editor__mobile-actions">
        <button type="button" className="btn" onClick={onClose}>
          Отмена
        </button>

        <button type="submit" className="btn btn--primary">
          Сохранить
        </button>
      </div>
    </form>
  );
}
