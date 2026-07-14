import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function labelTableCells(root) {
  root.querySelectorAll("table.data-table").forEach((table) => {
    const labels = [...table.querySelectorAll("thead th")].map((cell) =>
      cell.textContent.trim(),
    );
    table.querySelectorAll("tbody tr").forEach((row) => {
      [...row.children].forEach((cell, index) => {
        if (cell.tagName === "TD")
          cell.dataset.label = labels[index] || "Значение";
      });
    });
  });
}

export function AdminResponsiveTables() {
  const { pathname } = useLocation();

  useEffect(() => {
    const root = document.querySelector(".admin-content");
    if (!root) return undefined;
    labelTableCells(root);
    const observer = new MutationObserver(() => labelTableCells(root));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
