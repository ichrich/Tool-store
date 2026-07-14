const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const mysql = require("mysql2/promise");

require("../config/env");
const { databaseConfig, pool } = require("../config/database");

async function inspectSchema(connection) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS table_count,
            SUM(table_name = 'users') AS has_users
     FROM information_schema.tables
     WHERE table_schema = DATABASE()`,
  );
  return {
    tableCount: Number(rows[0]?.table_count || 0),
    hasUsers: Number(rows[0]?.has_users || 0) > 0,
  };
}

async function setup() {
  const connection = await mysql.createConnection({
    ...databaseConfig,
    multipleStatements: true,
  });

  try {
    const schemaState = await inspectSchema(connection);
    if (schemaState.hasUsers) {
      console.log("Схема БД уже существует, инициализация пропущена.");
      return;
    }
    if (schemaState.tableCount > 0) {
      throw new Error(
        "База не пустая, но таблица users отсутствует. Автоматическая инициализация остановлена без изменений.",
      );
    }

    const schemaPath = path.resolve(__dirname, "../../../schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await connection.query(schema);
    console.log("Схема БД создана.");
  } finally {
    await connection.end();
  }

  execFileSync(process.execPath, [path.resolve(__dirname, "seed.js")], {
    stdio: "inherit",
    env: process.env,
  });
  execFileSync(
    process.execPath,
    [path.resolve(__dirname, "backfillCharacteristics.js")],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
}

setup()
  .catch((error) => {
    console.error("Не удалось подготовить базу данных:", error.message);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
