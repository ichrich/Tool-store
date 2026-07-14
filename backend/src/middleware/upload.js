const fs = require("fs");
const path = require("path");
const multer = require("multer");
require("dotenv").config();

const uploadDir = path.resolve(
  process.cwd(),
  process.env.UPLOAD_DIR || "uploads",
);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
    const safe = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, safe);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const allowedMime = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!allowed.includes(ext) || !allowedMime.includes(file.mimetype)) {
    return cb(new Error("Допустимы только изображения: jpg, png, gif, webp"));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 },
});

function publicPathForFile(filename) {
  const base = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
  return `${base}/uploads/${filename}`;
}

module.exports = { upload, uploadDir, publicPathForFile };
