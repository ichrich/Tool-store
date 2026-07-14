import { useEffect, useRef } from "react";
import { fetchNotifications, markNotificationRead } from "../api/publicApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const TYPE_TOAST = {
  order_created: "success",
  order_status: "info",
  order_delivered: "success",
  review_report: "info",
  account_blocked: "warning",
  appeal_created: "info",
  appeal_resolved: "info",
  payment_failed: "error",
  payment_paid: "success",
};

const TEXT_REPLACEMENTS = {
  "Новый статус: new": "Новый статус: Новый",
  "Новый статус: processing": "Новый статус: В обработке",
  "Новый статус: completed": "Новый статус: Выполнен",
  "Новый статус: delivered": "Новый статус: Доставлен",
  "Новый статус: cancelled": "Новый статус: Отменён",
  "способ оплаты: cash": "способ оплаты: наличными при получении",
  "Способ оплаты: cash": "Способ оплаты: наличными при получении",
  "способ оплаты: yookassa": "способ оплаты: ЮKassa",
  "Способ оплаты: yookassa": "Способ оплаты: ЮKassa",
  "Причина: spam": "Причина: Спам",
  "Причина: insult": "Причина: Оскорбления",
  "Причина: fake": "Причина: Недостоверный отзыв",
  "Причина: other": "Причина: Другое",
  "Причина: photo": "Причина: Фото в отзыве",
};

function localizeText(value) {
  let text = String(value || "");
  for (const [from, to] of Object.entries(TEXT_REPLACEMENTS)) {
    text = text.replaceAll(from, to);
  }
  return text;
}

export function NotificationToaster() {
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const shownIds = useRef(new Set());

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;

    async function load() {
      try {
        const rows = await fetchNotifications();
        if (cancelled) return;
        const unread = (rows || [])
          .filter((item) => !item.is_read && !shownIds.current.has(item.id))
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        for (const item of unread) {
          shownIds.current.add(item.id);
          const type = TYPE_TOAST[item.type] || "info";
          toast.show(type, localizeText(item.body || item.title), {
            title: localizeText(item.title),
            duration:
              item.type === "account_blocked" || item.type === "appeal_resolved"
                ? 10000
                : 6500,
          });
          markNotificationRead(item.id).catch(() => {});
        }
      } catch {
        // Polling should stay quiet: failed notification fetch must not disturb the user.
      }
    }

    load();
    const timer = window.setInterval(load, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAuthenticated, toast]);

  return null;
}
