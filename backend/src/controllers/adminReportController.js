const fs = require("fs");
const { pool } = require("../config/database");

const REPORTS = {
  orders: {
    title: "Отчёт по заказам",
    sheet: "Заказы",
    filename: "otchet_zakazy",
    columns: [
      { header: "Номер", key: "id", width: 10 },
      { header: "Статус заказа", key: "status_label", width: 20 },
      { header: "Клиент", key: "customer_name", width: 24 },
      { header: "Email", key: "customer_email", width: 28 },
      { header: "Телефон", key: "customer_phone", width: 18 },
      { header: "Способ оплаты", key: "payment_method_label", width: 20 },
      { header: "Статус оплаты", key: "payment_status_label", width: 18 },
      { header: "Сумма", key: "total_amount", width: 16, numFmt: "#,##0.00 ₽" },
      {
        header: "Скидка",
        key: "discount_amount",
        width: 14,
        numFmt: "#,##0.00 ₽",
      },
      { header: "Промокод", key: "promo_code", width: 16 },
      { header: "Позиций", key: "items_count", width: 12 },
      { header: "Дата создания", key: "created_at", width: 22 },
    ],
  },
  products: {
    title: "Отчёт по товарам",
    sheet: "Товары",
    filename: "otchet_tovary",
    columns: [
      { header: "Номер", key: "id", width: 10 },
      { header: "Товар", key: "name", width: 44 },
      { header: "Категория", key: "category", width: 24 },
      { header: "Цена", key: "price", width: 14, numFmt: "#,##0.00 ₽" },
      { header: "Остаток", key: "stock", width: 12 },
      { header: "Заказов", key: "orders_count", width: 12 },
      { header: "Продано", key: "total_sold", width: 12 },
      {
        header: "Выручка",
        key: "total_revenue",
        width: 16,
        numFmt: "#,##0.00 ₽",
      },
      { header: "Рейтинг", key: "avg_rating", width: 12, numFmt: "0.0" },
      { header: "Отзывов", key: "reviews_count", width: 12 },
    ],
  },
  users: {
    title: "Отчёт по пользователям",
    sheet: "Пользователи",
    filename: "otchet_polzovateli",
    columns: [
      { header: "Номер", key: "id", width: 10 },
      { header: "Email", key: "email", width: 30 },
      { header: "Имя", key: "first_name", width: 18 },
      { header: "Фамилия", key: "last_name", width: 18 },
      { header: "Роль", key: "role_label", width: 16 },
      { header: "Статус аккаунта", key: "active_label", width: 18 },
      { header: "Дата регистрации", key: "created_at", width: 22 },
      { header: "Заказов", key: "orders_count", width: 12 },
      {
        header: "Потрачено",
        key: "total_spent",
        width: 16,
        numFmt: "#,##0.00 ₽",
      },
      { header: "Отзывов", key: "reviews_count", width: 12 },
    ],
  },
};

const ORDER_STATUS = {
  new: "Новый",
  processing: "В обработке",
  completed: "Выполнен",
  delivered: "Доставлен",
  cancelled: "Отменён",
};

const PAYMENT_METHOD = {
  cash: "Наличными при получении",
  yookassa: "ЮKassa",
};

const PAYMENT_STATUS = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  failed: "Ошибка оплаты",
};

const ROLE = {
  admin: "Администратор",
  user: "Пользователь",
};

function formatDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ru-RU", { hour12: false });
}

function normalizeRows(rows, reportKey) {
  return rows.map((row) => {
    const next = { ...row };
    for (const [key, value] of Object.entries(next)) {
      if (value instanceof Date) next[key] = formatDateTime(value);
      if (typeof value === "bigint") next[key] = Number(value);
      if (Buffer.isBuffer(value)) next[key] = value.toString("utf8");
    }
    if (reportKey === "orders") {
      next.status_label = ORDER_STATUS[next.status] || next.status;
      next.payment_method_label =
        PAYMENT_METHOD[next.payment_method] || next.payment_method;
      next.payment_status_label =
        next.payment_method === "cash" && next.payment_status === "pending"
          ? "Не оплачено"
          : PAYMENT_STATUS[next.payment_status] || next.payment_status;
    }
    if (reportKey === "users") {
      next.role_label = ROLE[next.role] || next.role;
      next.active_label = Number(next.is_active) ? "Активен" : "Заблокирован";
    }
    return next;
  });
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
}

function getPeriod(req) {
  const from = req.query.from ? String(req.query.from) : "";
  const to = req.query.to ? String(req.query.to) : "";
  if (from && to) return `с ${from} по ${to}`;
  if (from) return `с ${from}`;
  if (to) return `по ${to}`;
  return "за весь период";
}

function makeMeta(req, report) {
  return {
    title: report.title,
    period: getPeriod(req),
    generated_by:
      req.user?.email ||
      `Администратор #${req.user?.id || req.user?.sub || "неизвестно"}`,
    generated_at: formatDateTime(new Date()),
  };
}

function sendCSV(res, report, rows, meta) {
  const lines = [
    [csvEscape(meta.title)].join(";"),
    [csvEscape(`Период: ${meta.period}`)].join(";"),
    [csvEscape(`Сформировал: ${meta.generated_by}`)].join(";"),
    [csvEscape(`Дата формирования: ${meta.generated_at}`)].join(";"),
    [csvEscape(`Всего записей: ${rows.length}`)].join(";"),
    "",
    report.columns.map((c) => csvEscape(c.header)).join(";"),
    ...rows.map((row) =>
      report.columns.map((c) => csvEscape(row[c.key])).join(";"),
    ),
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${report.filename}.csv"`,
  );
  return res.send(`\uFEFF${lines.join("\r\n")}`);
}

async function sendXLSX(res, report, rows, meta) {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = meta.generated_by || "Администратор";
  wb.created = new Date();
  const ws = wb.addWorksheet(report.sheet, {
    views: [{ state: "frozen", ySplit: 7 }],
  });

  const metaRows = [
    [meta.title],
    [`Период: ${meta.period}`],
    [`Сформировал: ${meta.generated_by}`],
    [`Дата формирования: ${meta.generated_at}`],
    [`Всего записей: ${rows.length}`],
    [],
  ];
  metaRows.forEach((row) => ws.addRow(row));
  ws.addRow(report.columns.map((c) => c.header));
  rows.forEach((row) => ws.addRow(report.columns.map((c) => row[c.key])));

  report.columns.forEach((c, index) => {
    const column = ws.getColumn(index + 1);
    column.width = c.width || 18;
    if (c.numFmt) column.numFmt = c.numFmt;
  });

  const width = Math.max(1, report.columns.length);
  for (let row = 1; row <= 5; row += 1) ws.mergeCells(row, 1, row, width);
  ws.getRow(1).font = { bold: true, size: 16, color: { argb: "FF111827" } };
  [2, 3, 4, 5].forEach((row) => {
    ws.getRow(row).font = { bold: true, color: { argb: "FF374151" } };
  });

  ws.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: 7, column: report.columns.length },
  };
  ws.getRow(7).height = 26;
  ws.getRow(7).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2F4050" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: false,
    };
    cell.border = { bottom: { style: "thin", color: { argb: "FFB8C2CC" } } };
  });

  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= 7) return;
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: false };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
    });
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      });
    }
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${report.filename}.xlsx"`,
  );
  await wb.xlsx.write(res);
  return res.end();
}

function findCyrillicFont() {
  const candidates = [
    "C:\\Windows\\Fonts\\arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
  ];
  return candidates.find((file) => fs.existsSync(file));
}

function sendPDF(res, report, rows, meta) {
  const PDFDocument = require("pdfkit");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${report.filename}.pdf"`,
  );
  const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
  doc.pipe(res);
  const font = findCyrillicFont();
  if (font) doc.font(font);

  doc.fontSize(16).text(meta.title, { underline: true });
  doc.moveDown(0.4);
  doc.fontSize(9).text(`Период: ${meta.period}`);
  doc.text(`Сформировал: ${meta.generated_by}`);
  doc.text(`Дата формирования: ${meta.generated_at}`);
  doc.text(`Всего записей: ${rows.length}`);
  doc.moveDown();

  rows.slice(0, 60).forEach((row) => {
    const line = report.columns
      .slice(0, 6)
      .map((c) => `${c.header}: ${row[c.key] ?? ""}`)
      .join(" | ");
    doc.fontSize(8).text(line, { lineGap: 2 });
  });
  if (rows.length > 60) doc.text(`... и ещё ${rows.length - 60} записей`);
  doc.end();
}

function respondReport(req, res, reportKey, rows, extra = {}) {
  const format = String(req.query.format || "json").toLowerCase();
  const report = REPORTS[reportKey];
  const normalized = normalizeRows(rows, reportKey);
  const meta = makeMeta(req, report);
  if (format === "csv") return sendCSV(res, report, normalized, meta);
  if (format === "xlsx" || format === "excel")
    return sendXLSX(res, report, normalized, meta);
  if (format === "pdf") return sendPDF(res, report, normalized, meta);
  return res.json({ rows: normalized, meta, ...extra });
}

async function ordersReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const conditions = [];
    const params = [];
    if (from) {
      conditions.push("o.created_at >= ?");
      params.push(from);
    }
    if (to) {
      conditions.push("o.created_at <= ?");
      params.push(`${to} 23:59:59`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await pool.query(
      `SELECT o.id, o.status, o.customer_name, o.customer_email, o.customer_phone,
              o.payment_method, o.payment_status, o.total_amount, o.discount_amount, o.promo_code,
              o.created_at,
              COUNT(oi.id) AS items_count
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${where}
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      params,
    );

    return respondReport(req, res, "orders", rows, {
      total: rows.length,
      sum: rows.reduce((s, r) => s + Number(r.total_amount || 0), 0),
    });
  } catch (e) {
    next(e);
  }
}

async function productsReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.name, c.name AS category, p.price, p.stock,
              COUNT(DISTINCT oi.order_id) AS orders_count,
              COALESCE(SUM(oi.quantity), 0) AS total_sold,
              COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue,
              AVG(r.rating) AS avg_rating,
              COUNT(DISTINCT r.id) AS reviews_count
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN reviews r ON r.product_id = p.id AND r.status <> 'deleted'
       WHERE p.is_deleted = 0
       GROUP BY p.id, p.name, c.name, p.price, p.stock
       ORDER BY total_sold DESC`,
    );

    return respondReport(req, res, "products", rows);
  } catch (e) {
    next(e);
  }
}

async function usersReport(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active,
              u.created_at,
              COUNT(DISTINCT o.id) AS orders_count,
              COALESCE(SUM(o.total_amount), 0) AS total_spent,
              COUNT(DISTINCT r.id) AS reviews_count
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       LEFT JOIN reviews r ON r.user_id = u.id AND r.status <> 'deleted'
       GROUP BY u.id, u.email, u.first_name, u.last_name, u.role, u.is_active, u.created_at
       ORDER BY total_spent DESC`,
    );

    return respondReport(req, res, "users", rows);
  } catch (e) {
    next(e);
  }
}

module.exports = { ordersReport, productsReport, usersReport };
