import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { formatPrice, imgSrc } from "../utils/format";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { useToast } from "../context/ToastContext";

export function CartPage() {
  const { items, setQty, removeItem, total } = useCart();
  const { warning } = useToast();

  if (items.length === 0) {
    return (
      <div className="container">
        <Breadcrumbs
          items={[{ label: "Главная", to: "/" }, { label: "Корзина" }]}
        />
        <h1>Корзина</h1>
        <div className="empty-state">
          <div className="empty-state__icon"></div>
          <div className="empty-state__title">Корзина пуста</div>
          <Link className="btn btn--primary" to="/catalog">
            В каталог
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Breadcrumbs
        items={[{ label: "Главная", to: "/" }, { label: "Корзина" }]}
      />
      <h1 style={{ marginBottom: "var(--space-5)" }}>Корзина</h1>

      <div className="table-wrap">
        <table className="data-table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              <th style={{ width: "44%" }}>Товар</th>
              <th style={{ width: "14%" }}>Цена</th>
              <th style={{ width: "16%" }}>Кол-во</th>
              <th style={{ width: "16%" }}>Сумма</th>
              <th style={{ width: "10%" }} />
            </tr>
          </thead>
          <tbody>
            {items.map((line) => {
              const src = imgSrc(line.image_path);
              const maxQ = Math.min(
                999,
                line.stock != null ? Number(line.stock) : 999,
              );
              return (
                <tr key={line.product_id}>
                  <td>
                    <div className="row">
                      {src && (
                        <img
                          src={src}
                          alt=""
                          width={56}
                          height={56}
                          style={{
                            objectFit: "cover",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--color-border)",
                          }}
                        />
                      )}
                      <Link to={`/product/${line.slug}`}>{line.name}</Link>
                    </div>
                  </td>
                  <td>{formatPrice(line.price)}</td>
                  <td>
                    <input
                      className="input"
                      style={{ width: 88 }}
                      type="number"
                      min={1}
                      max={maxQ}
                      value={line.quantity}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (Number.isNaN(v)) return;
                        if (v > maxQ) warning(`Максимум ${maxQ} шт. на складе`);
                        setQty(line.product_id, v, line.stock);
                      }}
                    />
                    <div className="field-hint">макс. {maxQ}</div>
                  </td>
                  <td>
                    <strong>{formatPrice(line.price * line.quantity)}</strong>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      onClick={() => removeItem(line.product_id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="row"
        style={{
          marginTop: "var(--space-5)",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
        }}
      >
        <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
          Итого: <span className="price">{formatPrice(total)}</span>
        </p>
        <Link className="btn btn--primary btn--lg" to="/checkout">
          Оформить заказ
        </Link>
      </div>
    </div>
  );
}
