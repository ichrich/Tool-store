import { Link } from "react-router-dom";
import { formatPrice, imgSrc } from "../utils/format";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { SafeImage } from "./SafeImage";

export function ProductCard({ product }) {
  const src = imgSrc(product.image_path);
  const { addItem } = useCart();
  const { success, warning } = useToast();

  function handleAdd(e) {
    e.preventDefault();
    if (product.stock <= 0) {
      warning("Товар отсутствует на складе");
      return;
    }
    addItem(product, 1);
    success(`${product.name} добавлен в корзину`);
  }

  return (
    <article className="card product-card">
      <Link to={`/product/${product.slug}`} className="product-card__media">
        <SafeImage
          src={src}
          alt={product.name}
          width={400}
          height={200}
          className="product-card__image"
        />
      </Link>

      <div className="card__body product-card__body">
        <div className="card__meta">{product.category_name}</div>
        <h3 className="card__title">
          <Link
            to={`/product/${product.slug}`}
            style={{ color: "var(--color-text)" }}
          >
            {product.name}
          </Link>
        </h3>

        <div className="product-card__footer">
          <div>
            <div className="price">{formatPrice(product.price)}</div>
            <div
              style={{
                fontSize: "0.75rem",
                color:
                  product.stock > 0
                    ? "var(--color-success)"
                    : "var(--color-error)",
                marginTop: 2,
              }}
            >
              {product.stock > 0
                ? ` В наличии (${product.stock})`
                : " Нет в наличии"}
            </div>
          </div>
          <button
            className="btn btn--primary btn--sm"
            onClick={handleAdd}
            disabled={product.stock <= 0}
            title={product.stock <= 0 ? "Нет в наличии" : "Добавить в корзину"}
          >
            Добавить в корзину
          </button>
        </div>
      </div>
    </article>
  );
}
