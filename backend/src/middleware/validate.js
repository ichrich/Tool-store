const { validationResult } = require("express-validator");

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const arr = errors.array({ onlyFirstError: false });
    const first = arr[0];
    const fields = {};
    for (const e of arr) {
      const path = e.path || e.param;
      if (path && !fields[path]) fields[path] = e.msg;
    }
    return res.status(400).json({
      error: first.msg,
      fields: Object.keys(fields).length ? fields : undefined,
    });
  }
  next();
}

module.exports = { handleValidationErrors };
