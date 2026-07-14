function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Файл не получен" });
    }
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url });
  } catch (e) {
    next(e);
  }
}

module.exports = { uploadImage };
