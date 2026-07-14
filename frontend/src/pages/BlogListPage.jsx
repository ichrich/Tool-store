import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchArticles } from "../api/publicApi";
import { imgSrc } from "../utils/format";
import { SafeImage } from "../components/SafeImage";

export function BlogListPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    fetchArticles()
      .then((rows) => active && setItems(rows))
      .catch(
        (requestError) =>
          active &&
          setError(
            requestError.response?.data?.error || "Не удалось загрузить статьи",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const [featured, ...rest] = items;

  return (
    <div className="blog-page">
      <header className="blog-heading">
        <div>
          <span className="eyebrow">База знаний</span>
          <h1>
            Разбираемся
            <br />в инструменте
          </h1>
        </div>
        <p>
          Практические материалы для выбора, эксплуатации и обслуживания
          профессионального оборудования.
        </p>
      </header>
      {loading && (
        <div className="page-loading">
          <span className="spinner spinner--lg" />
        </div>
      )}
      {error && <div className="alert alert--error">{error}</div>}
      {featured && (
        <Link to={`/blog/${featured.slug}`} className="featured-article">
          <div className="featured-article__media">
            {featured.cover_image ? (
              <SafeImage
                src={imgSrc(featured.cover_image)}
                alt={featured.title}
              />
            ) : (
              <BookOpen size={56} />
            )}
          </div>
          <div className="featured-article__content">
            <span className="article-label">Новая публикация</span>
            <h2>{featured.title}</h2>
            {featured.excerpt && <p>{featured.excerpt}</p>}
            <span className="article-meta">
              <CalendarDays size={15} />
              {new Date(featured.created_at).toLocaleDateString("ru-RU")}
              <ArrowRight size={18} />
            </span>
          </div>
        </Link>
      )}
      {rest.length > 0 && (
        <section className="blog-grid">
          {rest.map((article, index) => (
            <Link
              key={article.id}
              to={`/blog/${article.slug}`}
              className="blog-card"
            >
              <div className="blog-card__index">
                {String(index + 2).padStart(2, "0")}
              </div>
              {article.cover_image && (
                <div className="blog-card__media">
                  <SafeImage
                    src={imgSrc(article.cover_image)}
                    alt={article.title}
                  />
                </div>
              )}
              <div className="blog-card__body">
                <span>
                  {new Date(article.created_at).toLocaleDateString("ru-RU")}
                </span>
                <h2>{article.title}</h2>
                {article.excerpt && <p>{article.excerpt}</p>}
                <strong>
                  Читать статью <ArrowRight size={16} />
                </strong>
              </div>
            </Link>
          ))}
        </section>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="empty-state">
          <BookOpen size={40} />
          <div className="empty-state__title">Публикаций пока нет</div>
          <p>Новые материалы появятся здесь.</p>
        </div>
      )}
    </div>
  );
}
