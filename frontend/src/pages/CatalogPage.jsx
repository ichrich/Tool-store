import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchBrands,
  fetchCategories,
  fetchProducts,
  fetchRecommendedCategoryProducts,
} from "../api/publicApi";
import { ProductCard } from "../components/ProductCard";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { Pagination } from "../components/Pagination";
import { useToast } from "../context/ToastContext";

const SORT_OPTIONS = [
  { value: "name", label: "Название" },
  { value: "price", label: "Цена" },
  { value: "created_at", label: "Дата добавления" },
  { value: "stock", label: "Наличие" },
];

const FILTER_DEBOUNCE_MS = 400;

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseNumberList(value) {
  return parseList(value)
    .map((x) => Number(x))
    .filter((x) => Number.isInteger(x) && x > 0);
}

function parseAttributeFilters(value) {
  const result = {};

  for (const group of String(value || "").split(";")) {
    const [characteristicIdRaw, valuesRaw] = group.split(":");
    const characteristicId = Number(characteristicIdRaw);

    if (
      !Number.isInteger(characteristicId) ||
      characteristicId < 1 ||
      !valuesRaw
    ) {
      continue;
    }

    const valueIds = valuesRaw
      .split(",")
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);

    if (valueIds.length > 0) {
      result[characteristicId] = [...new Set(valueIds)];
    }
  }

  return result;
}

function serializeAttributeFilters(attributes) {
  return Object.entries(attributes || {})
    .filter(([, valueIds]) => valueIds.length > 0)
    .map(
      ([characteristicId, valueIds]) =>
        `${characteristicId}:${valueIds.join(",")}`,
    )
    .join(";");
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { error: showError } = useToast();

  const [categories, setCategories] = useState([]);
  const [brandData, setBrandData] = useState({ brands: [], models: [] });
  const [data, setData] = useState({ items: [], total: 0 });
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const getParam = (key, def = "") => searchParams.get(key) || def;
  const category = getParam("category");
  const brandsParam = getParam("brands");
  const modelsParam = getParam("models");
  const attributesParam = getParam("attributes");
  const brands = parseList(brandsParam);
  const models = parseNumberList(modelsParam);
  const attributes = parseAttributeFilters(attributesParam);
  const minPrice = getParam("minPrice");
  const maxPrice = getParam("maxPrice");
  const search = getParam("search");
  const sort = getParam("sort", "name");
  const order = getParam("order", "asc");
  const page = Number(getParam("page", "1"));
  const limit = Number(getParam("limit", "12"));

  const [filters, setFilters] = useState({
    category,
    brands,
    models,
    attributes,
    minPrice,
    maxPrice,
    search,
  });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const debounceTimer = useRef(null);

  useEffect(() => {
    setFilters({
      category,
      brands,
      models,
      attributes,
      minPrice,
      maxPrice,
      search,
    });
  }, [
    category,
    brandsParam,
    modelsParam,
    attributesParam,
    minPrice,
    maxPrice,
    search,
  ]);

  const pushFiltersToUrl = useCallback(
    (f) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (f.category) next.set("category", String(f.category));
        else next.delete("category");
        if (f.brands?.length) next.set("brands", f.brands.join(","));
        else next.delete("brands");
        next.delete("brand");
        if (f.models?.length) next.set("models", f.models.join(","));
        else next.delete("models");
        next.delete("model");
        const serializedAttributes = serializeAttributeFilters(f.attributes);
        if (serializedAttributes) next.set("attributes", serializedAttributes);
        else next.delete("attributes");
        if (f.minPrice) next.set("minPrice", String(f.minPrice));
        else next.delete("minPrice");
        if (f.maxPrice) next.set("maxPrice", String(f.maxPrice));
        else next.delete("maxPrice");
        if (f.search) next.set("search", String(f.search));
        else next.delete("search");
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  function scheduleUrlFromFilters() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      pushFiltersToUrl(filtersRef.current);
    }, FILTER_DEBOUNCE_MS);
  }

  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );

  const handleSort = useCallback(
    (field) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const curSort = prev.get("sort") || "name";
        const curOrder = prev.get("order") || "asc";
        if (curSort === field) {
          next.set("order", curOrder === "asc" ? "desc" : "asc");
        } else {
          next.set("sort", field);
          next.set("order", "asc");
        }
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  function resetFilters() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setFilters({
      category: "",
      brands: [],
      models: [],
      attributes: {},
      minPrice: "",
      maxPrice: "",
      search: "",
    });
    setSearchParams({});
  }

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {});
    fetchBrands()
      .then(setBrandData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchProducts({
      category: category || undefined,
      brands: brands.length ? brands.join(",") : undefined,
      models: models.length ? models.join(",") : undefined,
      attributes: attributesParam || undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      search: search || undefined,
      sort,
      order,
      page,
      limit,
    })
      .then((res) => setData(res))
      .catch((err) => showError(err.userMessage || "Ошибка загрузки каталога"))
      .finally(() => setLoading(false));
  }, [
    category,
    brandsParam,
    modelsParam,
    attributesParam,
    minPrice,
    maxPrice,
    search,
    sort,
    order,
    page,
    limit,
  ]);

  useEffect(() => {
    if (!category) {
      setRecommendedProducts([]);
      return;
    }
    fetchRecommendedCategoryProducts(category, { limit: 8 })
      .then((res) => setRecommendedProducts(res.items || []))
      .catch(() => setRecommendedProducts([]));
  }, [category]);

  const brandTree = useMemo(
    () =>
      brandData.brands.map((brandItem) => ({
        ...brandItem,
        models: brandData.models.filter((m) => m.brand_slug === brandItem.slug),
      })),
    [brandData],
  );

  function toggleBrand(brandSlug) {
    const brandModels = brandData.models
      .filter((m) => m.brand_slug === brandSlug)
      .map((m) => m.id);
    const enabled = filtersRef.current.brands.includes(brandSlug);
    const nextFilters = {
      ...filtersRef.current,
      brands: enabled
        ? filtersRef.current.brands.filter((x) => x !== brandSlug)
        : [...filtersRef.current.brands, brandSlug],
      models: enabled
        ? filtersRef.current.models.filter((id) => !brandModels.includes(id))
        : filtersRef.current.models,
    };
    setFilters(nextFilters);
    pushFiltersToUrl(nextFilters);
  }

  function toggleModel(modelItem) {
    const enabled = filtersRef.current.models.includes(modelItem.id);
    const nextModels = enabled
      ? filtersRef.current.models.filter((id) => id !== modelItem.id)
      : [...filtersRef.current.models, modelItem.id];
    const nextFilters = {
      ...filtersRef.current,
      models: nextModels,
    };
    setFilters(nextFilters);
    pushFiltersToUrl(nextFilters);
  }

  function toggleCharacteristicValue(characteristicId, valueId) {
    const currentValues = filtersRef.current.attributes[characteristicId] || [];
    const enabled = currentValues.includes(valueId);
    const nextValues = enabled
      ? currentValues.filter((id) => id !== valueId)
      : [...currentValues, valueId];
    const nextAttributes = { ...filtersRef.current.attributes };

    if (nextValues.length > 0) {
      nextAttributes[characteristicId] = nextValues;
    } else {
      delete nextAttributes[characteristicId];
    }

    const nextFilters = {
      ...filtersRef.current,
      attributes: nextAttributes,
    };
    setFilters(nextFilters);
    pushFiltersToUrl(nextFilters);
  }

  function SortHeader({ field, label }) {
    const isActive = sort === field;
    const icon = isActive ? (order === "asc" ? " ↑" : " ↓") : " ↕";
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: isActive
            ? "var(--color-accent)"
            : "var(--color-text-secondary)",
          fontWeight: isActive ? 700 : 500,
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: 0,
          font: "inherit",
          fontSize: "0.85rem",
        }}
      >
        {label}
        <span style={{ opacity: isActive ? 1 : 0.4, fontSize: "0.7rem" }}>
          {icon}
        </span>
      </button>
    );
  }

  return (
    <div className="container">
      <Breadcrumbs
        items={[{ label: "Главная", to: "/" }, { label: "Каталог" }]}
      />
      <h1 style={{ marginBottom: "var(--space-5)" }}>Каталог</h1>

      <div className="split">
        <aside>
          <div className="card">
            <div className="card__body">
              <h3 style={{ marginBottom: "var(--space-4)", fontSize: "1rem" }}>
                Фильтры
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (debounceTimer.current)
                    clearTimeout(debounceTimer.current);
                  pushFiltersToUrl(filters);
                }}
              >
                <div className="field">
                  <label>Категория</label>
                  <select
                    className="select"
                    value={filters.category}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFilters((f) => ({ ...f, category: v }));
                      if (debounceTimer.current)
                        clearTimeout(debounceTimer.current);
                      debounceTimer.current = null;
                      pushFiltersToUrl({ ...filtersRef.current, category: v });
                    }}
                  >
                    <option value="">Все категории</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Бренды и модели</label>
                  <div className="brand-filter-tree">
                    {brandTree.map((b) => {
                      const brandChecked = filters.brands.includes(b.slug);
                      const selectedModels = b.models.filter((m) =>
                        filters.models.includes(m.id),
                      ).length;
                      return (
                        <details
                          key={b.id}
                          className="brand-filter-node"
                          open={brandChecked || selectedModels > 0}
                        >
                          <summary>
                            <label
                              className="check-row"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={brandChecked}
                                onChange={() => toggleBrand(b.slug)}
                              />
                              <span>{b.name}</span>
                              <small>{b.products_count}</small>
                            </label>
                          </summary>
                          <div className="brand-filter-models">
                            {b.models.length === 0 ? (
                              <span className="muted">Нет моделей</span>
                            ) : (
                              b.models.map((m) => (
                                <label
                                  key={m.id}
                                  className="check-row check-row--nested"
                                >
                                  <input
                                    type="checkbox"
                                    checked={filters.models.includes(m.id)}
                                    onChange={() => toggleModel(m)}
                                  />
                                  <span>{m.name}</span>
                                </label>
                              ))
                            )}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
                <div className="field">
                  <label>Цена от</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={filters.minPrice}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFilters((f) => ({ ...f, minPrice: v }));
                      scheduleUrlFromFilters();
                    }}
                  />
                </div>
                <div className="field">
                  <label>Цена до</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="999999"
                    value={filters.maxPrice}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFilters((f) => ({ ...f, maxPrice: v }));
                      scheduleUrlFromFilters();
                    }}
                  />
                </div>
                {(data.characteristics || []).length > 0 && (
                  <div
                    className="field spec-facets"
                    key={`${filters.category || "all"}:${(data.characteristics || []).map((item) => `${item.id}-${item.values.length}`).join("|")}`}
                  >
                    <label>Характеристики</label>
                    <div className="spec-filter-groups">
                      {data.characteristics.map((characteristic) => {
                        const selectedValues =
                          filters.attributes[characteristic.id] || [];
                        return (
                          <details
                            key={characteristic.id}
                            className="spec-filter-group"
                            open={selectedValues.length > 0}
                          >
                            <summary>
                              <span>{characteristic.name}</span>
                              {selectedValues.length > 0 && (
                                <small>{selectedValues.length} выбрано</small>
                              )}
                            </summary>
                            <div>
                              {characteristic.values.map((value) => (
                                <label key={value.id} className="check-row">
                                  <input
                                    type="checkbox"
                                    checked={selectedValues.includes(value.id)}
                                    onChange={() =>
                                      toggleCharacteristicValue(
                                        characteristic.id,
                                        value.id,
                                      )
                                    }
                                  />
                                  <span>{value.value}</span>
                                  <small>{value.count}</small>
                                </label>
                              ))}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="row">
                  <button type="submit" className="btn btn--primary">
                    Применить сейчас
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={resetFilters}
                  >
                    Сбросить
                  </button>
                </div>
              </form>

              <hr
                style={{
                  borderColor: "var(--color-border)",
                  margin: "var(--space-4) 0",
                  opacity: 0.5,
                }}
              />
              <h4
                style={{
                  fontSize: "0.85rem",
                  color: "var(--color-text-muted)",
                  marginBottom: "var(--space-3)",
                }}
              >
                СОРТИРОВКА
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <SortHeader
                    key={opt.value}
                    field={opt.value}
                    label={opt.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div>
          <div className="field" style={{ marginBottom: "var(--space-3)" }}>
            <label>Поиск по товарам</label>
            <div className="row">
              <input
                className="input"
                type="search"
                placeholder="Введите название товара"
                value={filters.search}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilters((f) => ({ ...f, search: v }));
                  scheduleUrlFromFilters();
                }}
                style={{ flex: 1, minWidth: 220 }}
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (debounceTimer.current)
                    clearTimeout(debounceTimer.current);
                  pushFiltersToUrl(filters);
                }}
              >
                Найти
              </button>
            </div>
          </div>
          <div
            className="row"
            style={{
              marginBottom: "var(--space-4)",
              justifyContent: "space-between",
            }}
          >
            <span className="muted">
              {loading ? "Загрузка..." : `Найдено: ${data.total}`}
            </span>
            <div className="page-size-selector">
              <span>Показывать:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set("limit", e.target.value);
                    next.set("page", "1");
                    return next;
                  });
                }}
              >
                {[12, 24, 48].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="page-loading">
              <div className="spinner spinner--lg" />
            </div>
          ) : data.items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon"></div>
              <div className="empty-state__title">Товары не найдены</div>
              <p>Попробуйте изменить условия поиска</p>
            </div>
          ) : (
            <>
              <div className="grid-products">
                {data.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              <Pagination
                page={page}
                total={data.total}
                limit={limit}
                onPageChange={(p) => {
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set("page", String(p));
                    return next;
                  });
                }}
              />
              {recommendedProducts.length > 0 && (
                <section className="recommended-category-products">
                  <div className="recommended-category-products__head">
                    <h2>Рекомендуем также</h2>
                    <p>
                      Подборка товаров из категорий, которые связаны с текущей
                      категорией в админке.
                    </p>
                  </div>
                  <div className="grid-products">
                    {recommendedProducts.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
