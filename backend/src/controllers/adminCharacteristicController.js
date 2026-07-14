const characteristicModel = require("../models/characteristicModel");

async function list(req, res, next) {
  try {
    const items = await characteristicModel.listAll();
    res.json(items);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list,
};
