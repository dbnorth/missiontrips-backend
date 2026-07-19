import db from "../models/index.js";
import fs from "fs";
import path from "path";

const Person = db.person;
const PersonDocument = db.personDocument;
const DocumentType = db.documentType;
const OrgPeopleRole = db.orgPeopleRole;
const Op = db.Sequelize.Op;
const exports = {};

const canManagePerson = async (req, personId) => {
  if (req.user?.isAdmin) return true;
  if (req.user?.personId && Number(req.user.personId) === Number(personId)) return true;
  const orgIds = (req.user?.orgRoles || [])
    .filter((r) => r.role?.roleName === "Org Admin" || r.roleName === "Org Admin")
    .map((r) => r.orgId);
  if (!orgIds.length) return false;
  const link = await OrgPeopleRole.findOne({
    where: { peopleId: personId, orgId: { [Op.in]: orgIds } },
  });
  return !!link;
};

const includeDocumentType = [
  { model: DocumentType, as: "documentType", attributes: ["id", "description", "type"] },
];

const documentPath = (documentFileName) => path.join("documents", documentFileName || "");

const removeDocumentFile = (documentFileName) => {
  if (!documentFileName) return;
  try {
    fs.unlinkSync(documentPath(documentFileName));
  } catch {
    /* ignore missing previous file */
  }
};

const cleanupUploadedFile = (req) => {
  if (!req.file) return;
  try {
    fs.unlinkSync(req.file.path);
  } catch {
    /* ignore cleanup errors */
  }
};

const validatePayload = async (body, { requireFile = false, file = null } = {}) => {
  const documentTypeId = Number(body.documentTypeId);
  if (!Number.isInteger(documentTypeId) || documentTypeId < 1) {
    return { error: "Document type is required." };
  }
  const documentType = await DocumentType.findByPk(documentTypeId);
  if (!documentType) return { error: "Document type not found." };

  if (!body.expirationDate) {
    return { error: "Expiration date is required." };
  }
  if (requireFile && !file) {
    return { error: "Document file is required." };
  }

  return {
    payload: {
      documentTypeId,
      countryIssued: body.countryIssued?.trim()?.toUpperCase() || null,
      issueDate: body.issueDate || null,
      expirationDate: body.expirationDate,
    },
  };
};

const loadForPerson = (id, personId) =>
  PersonDocument.findOne({
    where: { id, personId },
    include: includeDocumentType,
  });

exports.findAll = async (req, res) => {
  try {
    const person = await Person.findByPk(req.params.id);
    if (!person) return res.status(404).send({ message: "Person not found." });
    if (!(await canManagePerson(req, person.id))) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const data = await PersonDocument.findAll({
      where: { personId: person.id },
      include: includeDocumentType,
      order: [
        [{ model: DocumentType, as: "documentType" }, "description", "ASC"],
        ["expirationDate", "ASC"],
      ],
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const person = await Person.findByPk(req.params.id);
    if (!person) {
      cleanupUploadedFile(req);
      return res.status(404).send({ message: "Person not found." });
    }
    if (!(await canManagePerson(req, person.id))) {
      cleanupUploadedFile(req);
      return res.status(403).send({ message: "Forbidden." });
    }

    const result = await validatePayload(req.body, { requireFile: true, file: req.file });
    if (result.error) {
      cleanupUploadedFile(req);
      return res.status(400).send({ message: result.error });
    }

    const data = await PersonDocument.create({
      personId: person.id,
      ...result.payload,
      documentFileName: path.join("people", req.file.filename).replace(/\\/g, "/"),
    });
    res.send(await loadForPerson(data.id, person.id));
  } catch (err) {
    cleanupUploadedFile(req);
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const person = await Person.findByPk(req.params.id);
    if (!person) {
      cleanupUploadedFile(req);
      return res.status(404).send({ message: "Person not found." });
    }
    if (!(await canManagePerson(req, person.id))) {
      cleanupUploadedFile(req);
      return res.status(403).send({ message: "Forbidden." });
    }

    const row = await PersonDocument.findOne({
      where: { id: req.params.documentId, personId: person.id },
    });
    if (!row) {
      cleanupUploadedFile(req);
      return res.status(404).send({ message: "Document not found." });
    }

    const result = await validatePayload(req.body, { file: req.file });
    if (result.error) {
      cleanupUploadedFile(req);
      return res.status(400).send({ message: result.error });
    }

    const payload = { ...result.payload };
    if (req.file) {
      removeDocumentFile(row.documentFileName);
      payload.documentFileName = path.join("people", req.file.filename).replace(/\\/g, "/");
    }
    await row.update(payload);
    res.send(await loadForPerson(row.id, person.id));
  } catch (err) {
    cleanupUploadedFile(req);
    res.status(500).send({ message: err.message });
  }
};

const serveDocument = async (req, res, { inline }) => {
  const person = await Person.findByPk(req.params.id);
  if (!person) return res.status(404).send({ message: "Person not found." });
  if (!(await canManagePerson(req, person.id))) {
    return res.status(403).send({ message: "Forbidden." });
  }

  const row = await PersonDocument.findOne({
    where: { id: req.params.documentId, personId: person.id },
  });
  if (!row) return res.status(404).send({ message: "Document not found." });

  const filePath = documentPath(row.documentFileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send({ message: "Document file not found." });
  }

  const fileName = path.basename(row.documentFileName);
  if (inline) {
    const disposition = `inline; filename="${fileName}"`;
    res.setHeader("Content-Disposition", disposition);
    return res.sendFile(path.resolve(filePath));
  }
  return res.download(filePath, fileName);
};

exports.view = async (req, res) => {
  try {
    await serveDocument(req, res, { inline: true });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.download = async (req, res) => {
  try {
    await serveDocument(req, res, { inline: false });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const person = await Person.findByPk(req.params.id);
    if (!person) return res.status(404).send({ message: "Person not found." });
    if (!(await canManagePerson(req, person.id))) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const row = await PersonDocument.findOne({
      where: { id: req.params.documentId, personId: person.id },
    });
    if (!row) return res.status(404).send({ message: "Document not found." });

    removeDocumentFile(row.documentFileName);
    await row.destroy();
    res.send({ message: "Document deleted." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
