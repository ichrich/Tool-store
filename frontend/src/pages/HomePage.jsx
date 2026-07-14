import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProducts, fetchRecommendations } from "../api/publicApi";
import { ProductCard } from "../components/ProductCard";
import { useToast } from "../context/ToastContext";
import { ArrowRight, BadgeCheck, PackageCheck, Truck } from "lucide-react";

export function HomePage() {
  const [items, setItems] = useState([]);
  const [recs, setRecs] = useState([]);
  const [recType, setRecType] = useState("popular");
  const [loading, setLoading] = useState(true);
  const { error: showError } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, rec] = await Promise.all([
          fetchProducts({ limit: 4, page: 1 }),
          fetchRecommendations().catch(() => ({ type: "popular", items: [] })),
        ]);
        if (!cancelled) {
          setItems(data.items || []);
          setRecs(rec.items || []);
          setRecType(rec.type || "popular");
        }
      } catch (e) {
        if (!cancelled)
          showError(e.userMessage || "Не удалось загрузить каталог");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero__content">
          <span className="hero-kicker">Оборудование для тех, кто делает</span>
          <h1>
            Инструмент.
            <br />
            <span>Без компромиссов.</span>
          </h1>
          <p>
            Профессиональная техника для производства, строительства и сервиса.
            Проверенный ассортимент, честные характеристики и понятная доставка.
          </p>
          <div className="row home-hero__actions">
            <Link className="btn btn--primary btn--lg" to="/catalog">
              Открыть каталог <ArrowRight size={18} />
            </Link>
            <Link className="btn btn--secondary btn--lg" to="/blog">
              Разобраться в выборе
            </Link>
          </div>
        </div>
        <div className="home-hero__signal" aria-hidden="true">
          <span>ТЕЛЕГА</span>
        </div>
      </section>

      <section className="trust-strip" aria-label="Преимущества">
        <div>
          <BadgeCheck size={24} />
          <span>
            <strong>Официальные бренды</strong>
            <small>Проверяем поставщиков</small>
          </span>
        </div>
        <div>
          <PackageCheck size={24} />
          <span>
            <strong>Актуальные остатки</strong>
            <small>Без заказов в пустоту</small>
          </span>
        </div>
        <div>
          <Truck size={24} />
          <span>
            <strong>Удобная доставка</strong>
            <small>До двери или пункта выдачи</small>
          </span>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Свежие поступления</span>
            <h2>Новинки витрины</h2>
          </div>
          <Link to="/catalog">
            Весь каталог <ArrowRight size={16} />
          </Link>
        </div>

        {loading && (
          <div className="page-loading">
            <div className="spinner spinner--lg" />
          </div>
        )}
        {!loading && (
          <div className="grid-products">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
      {recs.length > 0 && (
        <section className="home-section home-section--muted">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Выбор покупателей</span>
              <h2>
                {recType === "personal"
                  ? "Рекомендуем вам"
                  : "Популярные товары"}
              </h2>
            </div>
          </div>
          <div className="grid-products">
            {recs.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
