import { useEffect } from "react";
import { X } from "lucide-react";
import { ModalPortal } from "./ModalPortal";

export function ConfirmModal({
  open,
  title = "Подтвердите действие",
  message,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  variant = "danger",
  onConfirm,
  onCancel,
  icon,
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const defaultIcons = { danger: "!", warning: "!", info: "i" };
  const displayIcon = icon || defaultIcons[variant] || "?";

  return (
    <ModalPortal>
      <div className="modal-overlay" onClick={onCancel}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal__header">
            <div>
              <div className="modal__icon">{displayIcon}</div>
              <h3 className="modal__title">{title}</h3>
            </div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={onCancel}
              aria-label="Закрыть"
            >
              <X size={18} />
            </button>
          </div>
          {message && <div className="modal__body">{message}</div>}
          <div className="modal__footer">
            <button className="btn" onClick={onCancel}>
              {cancelText}
            </button>
            <button
              className={`btn btn--${variant === "danger" ? "danger" : "primary"}`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
