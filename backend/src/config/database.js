require("./env");

const mysql = require("mysql2/promise");

function booleanEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
}

function connectionFromUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!["mysql:", "mysql2:"].includes(url.protocol)) {
    throw new Error("DATABASE_URL должен использовать протокол mysql://");
  }

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
}

const databaseConfig = {
  ...(process.env.DATABASE_URL
    ? connectionFromUrl(process.env.DATABASE_URL)
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD ?? "",
        database: process.env.DB_NAME || "telega",
      }),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ...(booleanEnv("DB_SSL", false)
    ? {
        ssl: {
          rejectUnauthorized: booleanEnv("DB_SSL_REJECT_UNAUTHORIZED", true),
        },
      }
    : {}),
};

const pool = mysql.createPool(databaseConfig);

async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

module.exports = { databaseConfig, pool, ping };
