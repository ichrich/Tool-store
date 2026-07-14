export function Pagination({
  page,
  total,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 25, 50],
}) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1 && !onLimitChange) return null;

  const pages = [];
  const delta = 2;
  for (
    let i = Math.max(1, page - delta);
    i <= Math.min(totalPages, page + delta);
    i++
  ) {
    pages.push(i);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--space-3)",
        marginTop: "var(--space-5)",
      }}
    >
      {onLimitChange && (
        <div className="page-size-selector">
          <span>Показывать по:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            {limitOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <span className="muted">Всего: {total}</span>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination__btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Предыдущая"
          ></button>

          {pages[0] > 1 && (
            <>
              <button
                className="pagination__btn"
                onClick={() => onPageChange(1)}
              >
                1
              </button>
              {pages[0] > 2 && <span className="muted">…</span>}
            </>
          )}

          {pages.map((p) => (
            <button
              key={p}
              className={`pagination__btn${p === page ? " pagination__btn--active" : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ))}

          {pages[pages.length - 1] < totalPages && (
            <>
              {pages[pages.length - 1] < totalPages - 1 && (
                <span className="muted">…</span>
              )}
              <button
                className="pagination__btn"
                onClick={() => onPageChange(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            className="pagination__btn"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Следующая"
          ></button>
        </div>
      )}
    </div>
  );
}
