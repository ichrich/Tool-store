import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchArticleBySlug } from "../api/publicApi";
import { imgSrc } from "../utils/format";
import { SafeImage } from "../components/SafeImage";
import { ArrowLeft, CalendarDays, UserRound } from "lucide-react";

export function BlogArticlePage() {
  const { slug } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await fetchArticleBySlug(slug);
        if (!cancelled) setArticle(row);
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
  }, [slug]);

  if (loading) return <p>Загрузка…</p>;
  if (error || !article)
    return <p className="field-error">{error || "Нет данных"}</p>;

  return (
    <article className="article-page article-page--editorial">
      <Link to="/blog" className="article-back">
        <ArrowLeft size={17} />
        Все статьи
      </Link>
      <header className="article-hero">
        <span className="eyebrow">Практическое руководство</span>
        <h1>{article.title}</h1>
        <div className="article-byline">
          <span>
            <UserRound size={16} />
            {article.author_name || article.author_email || "Редакция Телеги"}
          </span>
          <span>
            <CalendarDays size={16} />
            {new Date(article.created_at).toLocaleDateString("ru-RU")}
          </span>
        </div>
      </header>
      <div className="article-content">
        {article.blocks.map((b) => {
          if (b.block_type === "text") {
            return (
              <div key={b.id} className="article-block article-block--text">
                <p>{b.body}</p>
              </div>
            );
          }
          if (b.block_type === "product") {
            return (
              <div key={b.id} className="article-block">
                {b.product_slug ? (
                  <Link
                    to={`/product/${b.product_slug}`}
                    className="article-product"
                  >
                    {b.product_image && (
                      <SafeImage
                        src={imgSrc(b.product_image)}
                        alt={b.product_name}
                      />
                    )}
                    <span>
                      <strong>{b.product_name}</strong>
                      <small>Перейти к товару</small>
                    </span>
                    {b.product_price != null && (
                      <p className="price">
                        {Number(b.product_price).toLocaleString("ru-RU")} ₽
                      </p>
                    )}
                  </Link>
                ) : (
                  <p className="muted">Товар не найден</p>
                )}
              </div>
            );
          }
          const src = imgSrc(b.body);
          return (
            <div key={b.id} className="article-block article-block--image">
              {src ? (
                <SafeImage src={src} alt="Иллюстрация к статье" />
              ) : (
                <p className="muted">Изображение не задано</p>
              )}
            </div>
          );
        })}
      </div>
      <footer className="article-footer">
        <span>Материал оказался полезным?</span>
        <Link className="btn btn--primary" to="/catalog">
          Перейти в каталог
        </Link>
      </footer>
    </article>
  );
}
