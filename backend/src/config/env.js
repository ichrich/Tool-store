const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");

const backendRoot = path.resolve(__dirname, "../..");
const envPath = path.join(backendRoot, ".env");

dotenv.config({ path: envPath });

const isProd = process.env.NODE_ENV === "production";
const placeholder = "replace-with-a-long-random-secret";

function ensureJwtSecret() {
  const current = process.env.JWT_SECRET;
  const missing = !current || !String(current).trim();
  const isPlaceholder = current === placeholder;

  if (!missing && !isPlaceholder) {
    return current;
  }

  if (isProd) {
    console.error(
      "Ошибка: задайте JWT_SECRET в файле backend/.env (скопируйте backend/.env.example и укажите длинный случайный ключ).",
    );
    process.exit(1);
  }

  const devSecret = crypto.randomBytes(32).toString("hex");
  process.env.JWT_SECRET = devSecret;
  console.warn(
    "JWT_SECRET не задан в backend/.env — для разработки сгенерирован временный ключ. " +
      "Создайте backend/.env из .env.example и укажите постоянный JWT_SECRET.",
  );
  return devSecret;
}

const jwtSecret = ensureJwtSecret();

module.exports = {
  envPath,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
};
