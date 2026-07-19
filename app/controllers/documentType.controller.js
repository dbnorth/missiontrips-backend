import db from "../models/index.js";
import { isSystemAdmin } from "../authorization/accessControl.js";

const DocumentType = db.documentType;
const DOCUMENT_TYPES = ["medical_licence", "passport"];

const requireSystemAdmin = (req, res) => {
  if (!isSystemAdmin(req)) {
    res.status(403).send({ message: "Forbidden." });
    return false;
  }
  return true;
};

const pickPayload = (body) => {
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    const val = body.description;
    payload.description = typeof val === "string" ? val.trim() : val;
  }
  if (Object.prototype.hasOwnProperty.call(body, "type")) {
    payload.type = body.type;
  }
  return payload;
};

const exports = {};

exports.findAll = async (req, res) => {
  try {
    const where = {};
    if (req.query.type && DOCUMENT_TYPES.includes(req.query.type)) {
      where.type = req.query.type;
    }

    const data = await DocumentType.findAll({
      where,
      order: [
        ["type", "ASC"],
        ["description", "ASC"],
      ],
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    if (!requireSystemAdmin(req, res)) return;
    const row = await DocumentType.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Document type not found." });
    res.send(row);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    if (!requireSystemAdmin(req, res)) return;

    const payload = pickPayload(req.body);
    if (!payload.description) {
      return res.status(400).send({ message: "Description is required." });
    }
    if (!payload.type || !DOCUMENT_TYPES.includes(payload.type)) {
      return res.status(400).send({
        message: "Type must be medical_licence or passport.",
      });
    }

    const data = await DocumentType.create({
      description: payload.description,
      type: payload.type,
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    if (!requireSystemAdmin(req, res)) return;

    const row = await DocumentType.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Document type not found." });

    const payload = pickPayload(req.body);
    if (Object.prototype.hasOwnProperty.call(payload, "description") && !payload.description) {
      return res.status(400).send({ message: "Description is required." });
    }
    if (
      Object.prototype.hasOwnProperty.call(payload, "type") &&
      !DOCUMENT_TYPES.includes(payload.type)
    ) {
      return res.status(400).send({
        message: "Type must be medical_licence or passport.",
      });
    }

    await row.update(payload);
    res.send(await DocumentType.findByPk(row.id));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    if (!requireSystemAdmin(req, res)) return;

    const row = await DocumentType.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Document type not found." });
    await row.destroy();
    res.send({ message: "Document type deleted." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
