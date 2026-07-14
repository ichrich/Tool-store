import { Link } from "react-router-dom";

export function Breadcrumbs({ items }) {
  // items: [{ label, to? }]
  if (!items || items.length === 0) return null;

  return (
    <nav className="breadcrumbs" aria-label="Хлебные крошки">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span
            key={i}
            style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
          >
            {i > 0 && <span className="breadcrumbs__sep"></span>}
            {isLast || !item.to ? (
              <span className="breadcrumbs__current">{item.label}</span>
            ) : (
              <Link to={item.to}>{item.label}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
