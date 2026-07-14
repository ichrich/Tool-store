import { useEffect, useState } from "react";

function formatMs(ms) {
  if (ms <= 0) return "0 сек.";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(`${d} д.`);
  if (h) parts.push(`${h} ч.`);
  if (m) parts.push(`${m} мин.`);
  if (!d && !h && !m) parts.push(`${sec} сек.`);
  else if (sec && !d) parts.push(`${sec} сек.`);
  return parts.join(" ");
}

/** Оставшееся время до снятия ограничения на отзывы (ISO expires_at). */
export function useReviewRestrictionCountdown(expiresAtIso) {
  const [label, setLabel] = useState("—");
  useEffect(() => {
    if (!expiresAtIso) {
      setLabel("—");
      return undefined;
    }
    const end = new Date(expiresAtIso).getTime();
    const tick = () => {
      const left = end - Date.now();
      setLabel(left <= 0 ? "истекло" : formatMs(left));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAtIso]);
  return label;
}

export function ReviewRestrictionModal({ open, data, onClose }) {
  const countdown = useReviewRestrictionCountdown(
    open && data && !data.permanent ? data.expires_at : null,
  );
  if (!open || !data) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <div className="modal__header">
          <h3 className="modal__title">Ограничение на отзывы</h3>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modal__body">
          <p>Вам ограничена возможность оставлять отзывы на сайте.</p>
          {data.reasons?.length > 0 && (
            <p>
              <strong>Причина:</strong> {data.reasons.join("; ")}
            </p>
          )}
          {data.permanent ? (
            <p className="muted">
              Срок: бессрочно (обратитесь в поддержку для уточнений).
            </p>
          ) : (
            <p>
              <strong>До снятия ограничения:</strong> {countdown}
            </p>
          )}
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
