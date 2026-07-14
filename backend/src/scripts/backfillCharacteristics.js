require("dotenv").config();

const { pool } = require("../config/database");
const characteristicModel = require("../models/characteristicModel");
const { extractSpecs } = require("../models/productModel");

function capitalize(value) {
  const text = String(value || "").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function classifySpec(spec) {
  const value = String(spec || "")
    .replace(/\s+/g, " ")
    .trim();
  const lower = value.toLowerCase();

  if (/\bвт\b/.test(lower)) return ["Мощность", value];
  if (/\bнм\b/.test(lower)) return ["Крутящий момент", value];
  if (/\bоб\/мин\b/.test(lower)) return ["Частота вращения", value];
  if (/^\d+(?:[.,]\d+)?\s*в$/i.test(value)) return ["Напряжение", value];
  if (/\bкг\b/.test(lower))
    return [lower.includes("грузопод") ? "Грузоподъёмность" : "Вес", value];
  if (/\bа\b/.test(lower) && /\d/.test(lower)) return ["Сила тока", value];
  if (lower.includes("скорост")) return ["Количество скоростей", value];
  if (lower.includes("точност")) return ["Точность", value];
  if (lower.includes("дальност")) return ["Дальность", value];
  if (lower.includes("патрон") && lower.includes("мм"))
    return ["Диаметр патрона", value];
  if (lower.includes("лента") && lower.includes("мм"))
    return ["Ширина ленты", value];
  if (lower.includes("вил") && lower.includes("мм"))
    return ["Длина вил", value];
  if (lower.includes("электрод") && lower.includes("мм"))
    return ["Диаметр электрода", value];
  if (/\bмм\b/.test(lower)) return ["Размер", value];
  if (/\bм\b/.test(lower) && /\d/.test(lower)) return ["Длина", value];
  if (lower.includes("положен")) return ["Количество положений", value];
  if (/^(mma|tig|mig)/i.test(value)) return ["Технология сварки", value];

  return [capitalize(value), "Да"];
}

function removeLegacySpecs(description) {
  const text = String(description || "");
  const markerIndex = text.toLowerCase().indexOf("характеристики:");
  return markerIndex >= 0 ? text.slice(0, markerIndex).trim() : text.trim();
}

async function run() {
  const [products] = await pool.query(
    `SELECT id, description
     FROM products
     WHERE is_deleted = 0`,
  );

  for (const product of products) {
    const groups = new Map();

    for (const spec of extractSpecs(product.description)) {
      const [characteristicName, value] = classifySpec(spec);

      if (!groups.has(characteristicName)) {
        groups.set(characteristicName, []);
      }

      groups.get(characteristicName).push({ value });
    }

    if (groups.size === 0) {
      continue;
    }

    const characteristics = [...groups.entries()].map(
      ([characteristicName, values]) => ({
        characteristic_name: characteristicName,
        values,
      }),
    );

    await characteristicModel.saveProductValues(product.id, characteristics);
    await pool.query("UPDATE products SET description = ? WHERE id = ?", [
      removeLegacySpecs(product.description),
      product.id,
    ]);
  }

  console.log(`Характеристики перенесены для ${products.length} товаров.`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
