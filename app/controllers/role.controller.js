import db from "../models/index.js";

const Role = db.role;
const exports = {};

exports.findAll = async (_req, res) => {
  try {
    const data = await Role.findAll({ order: [["roleName", "ASC"]] });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
