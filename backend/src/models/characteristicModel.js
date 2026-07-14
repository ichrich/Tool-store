const { pool } = require("../config/database");
const { slugFromTitle } = require("../utils/slug");

function normalizeName(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function listAll() {
  const [rows] = await pool.query(
    `SELECT c.id AS characteristic_id,
            c.name AS characteristic_name,
            c.slug AS characteristic_slug,
            c.sort_order AS characteristic_sort_order,
            cv.id AS value_id,
            cv.value,
            cv.sort_order AS value_sort_order
     FROM characteristics c
     LEFT JOIN characteristic_values cv ON cv.characteristic_id = c.id
     ORDER BY c.sort_order, c.name, cv.sort_order, cv.value`,
  );

  const groups = new Map();

  for (const row of rows) {
    if (!groups.has(row.characteristic_id)) {
      groups.set(row.characteristic_id, {
        id: row.characteristic_id,
        name: row.characteristic_name,
        slug: row.characteristic_slug,
        values: [],
      });
    }

    if (row.value_id) {
      groups.get(row.characteristic_id).values.push({
        id: row.value_id,
        value: row.value,
      });
    }
  }

  return [...groups.values()];
}

async function getProductValues(productId) {
  const [rows] = await pool.query(
    `SELECT c.id AS characteristic_id,
            c.name AS characteristic_name,
            cv.id AS value_id,
            cv.value
     FROM product_characteristic_values pcv
     JOIN characteristic_values cv ON cv.id = pcv.value_id
     JOIN characteristics c ON c.id = cv.characteristic_id
     WHERE pcv.product_id = ?
     ORDER BY c.sort_order, c.name, cv.sort_order, cv.value`,
    [productId],
  );

  return rows;
}

async function resolveCharacteristic(conn, item) {
  const characteristicId = Number(item.characteristic_id);

  if (Number.isInteger(characteristicId) && characteristicId > 0) {
    const [[existing]] = await conn.query(
      "SELECT id FROM characteristics WHERE id = ? LIMIT 1",
      [characteristicId],
    );

    if (!existing) {
      const error = new Error("Характеристика не найдена");
      error.status = 400;
      throw error;
    }

    return characteristicId;
  }

  const name = normalizeName(item.characteristic_name, 120);

  if (!name) {
    const error = new Error("Укажите название характеристики");
    error.status = 400;
    throw error;
  }

  const [[existing]] = await conn.query(
    "SELECT id FROM characteristics WHERE name = ? LIMIT 1",
    [name],
  );

  if (existing) {
    return existing.id;
  }

  let slug = slugFromTitle(name);
  let suffix = 2;

  while (true) {
    const [[slugConflict]] = await conn.query(
      "SELECT id FROM characteristics WHERE slug = ? LIMIT 1",
      [slug],
    );

    if (!slugConflict) {
      break;
    }

    slug = `${slugFromTitle(name)}-${suffix}`;
    suffix += 1;
  }

  const [result] = await conn.query(
    "INSERT INTO characteristics (name, slug) VALUES (?, ?)",
    [name, slug],
  );

  return result.insertId;
}

async function resolveValue(conn, characteristicId, valueItem) {
  const valueId = Number(valueItem.value_id);

  if (Number.isInteger(valueId) && valueId > 0) {
    const [[existing]] = await conn.query(
      `SELECT id
       FROM characteristic_values
       WHERE id = ? AND characteristic_id = ?
       LIMIT 1`,
      [valueId, characteristicId],
    );

    if (!existing) {
      const error = new Error("Значение характеристики не найдено");
      error.status = 400;
      throw error;
    }

    return valueId;
  }

  const value = normalizeName(valueItem.value, 160);

  if (!value) {
    const error = new Error("Укажите значение характеристики");
    error.status = 400;
    throw error;
  }

  const [[existing]] = await conn.query(
    `SELECT id
     FROM characteristic_values
     WHERE characteristic_id = ? AND value = ?
     LIMIT 1`,
    [characteristicId, value],
  );

  if (existing) {
    return existing.id;
  }

  const [result] = await conn.query(
    `INSERT INTO characteristic_values (characteristic_id, value)
     VALUES (?, ?)`,
    [characteristicId, value],
  );

  return result.insertId;
}

async function saveProductValues(productId, items) {
  const normalizedItems = Array.isArray(items) ? items.slice(0, 100) : [];
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await conn.query(
      "DELETE FROM product_characteristic_values WHERE product_id = ?",
      [productId],
    );

    const valueIds = new Set();

    for (const item of normalizedItems) {
      const characteristicId = await resolveCharacteristic(conn, item);
      const values = Array.isArray(item.values) ? item.values.slice(0, 50) : [];

      for (const valueItem of values) {
        const valueId = await resolveValue(conn, characteristicId, valueItem);
        valueIds.add(valueId);
      }
    }

    if (valueIds.size > 0) {
      await conn.query(
        `INSERT INTO product_characteristic_values (product_id, value_id)
         VALUES ?`,
        [[...valueIds].map((valueId) => [productId, valueId])],
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  getProductValues,
  listAll,
  saveProductValues,
};
