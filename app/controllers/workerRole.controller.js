import db from "../models/index.js";
import {
  canAccessOrg,
  isOrgAdminForOrg,
  isSystemAdmin,
  parseOrganizationScopeHeader,
  ROLE_ORG_ADMIN,
} from "../authorization/accessControl.js";

const WorkerRole = db.workerRole;
const Organization = db.organization;
const DocumentType = db.documentType;
const STATUSES = ["active", "inactive"];

const roleIncludes = [
  { model: Organization, as: "organization", attributes: ["id", "name"] },
  { model: DocumentType, as: "documentType", attributes: ["id", "description", "type"] },
];

const getOrgAdminOrgIds = (req) => [
  ...new Set(
    (req.user?.orgRoles || [])
      .filter((r) => r.role?.roleName === ROLE_ORG_ADMIN)
      .map((r) => Number(r.orgId))
  ),
];

const resolveOrgId = (req, bodyOrgId) => {
  if (bodyOrgId != null && bodyOrgId !== "") {
    return Number(bodyOrgId);
  }
  const scoped = parseOrganizationScopeHeader(req);
  if (isSystemAdmin(req)) return scoped;
  const adminOrgIds = getOrgAdminOrgIds(req);
  if (scoped != null && adminOrgIds.includes(scoped)) return scoped;
  if (adminOrgIds.length === 1) return adminOrgIds[0];
  return scoped ?? adminOrgIds[0] ?? null;
};

const canManageOrg = (req, orgId) => isOrgAdminForOrg(req, orgId);

const loadRole = (id) =>
  WorkerRole.findByPk(id, {
    include: roleIncludes,
  });

const pickPayload = (body) => {
  const payload = {};
  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    payload.name = typeof body.name === "string" ? body.name.trim() : body.name;
  }
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    const val = body.description;
    payload.description = typeof val === "string" ? val.trim() || null : val ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "licenseRequired")) {
    payload.licenseRequired = !!body.licenseRequired;
  }
  if (Object.prototype.hasOwnProperty.call(body, "documentTypeId")) {
    const val = body.documentTypeId;
    payload.documentTypeId = val === "" || val == null ? null : Number(val);
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    payload.status = body.status;
  }
  return payload;
};

const exports = {};

exports.findAll = async (req, res) => {
  try {
    const orgId = resolveOrgId(req, req.query.orgId);
    if (!orgId) {
      if (isSystemAdmin(req)) return res.send([]);
      return res.status(400).send({ message: "Organization is required." });
    }
    // Reading the list is open to anyone with org access (e.g. trip leaders
    // picking roles for a trip); managing stays limited to org admins.
    if (!canAccessOrg(req, orgId)) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const where = { orgId };
    if (req.query.status && STATUSES.includes(req.query.status)) {
      where.status = req.query.status;
    }

    const data = await WorkerRole.findAll({
      where,
      include: roleIncludes,
      order: [
        ["status", "ASC"],
        ["name", "ASC"],
      ],
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const role = await loadRole(req.params.id);
    if (!role) return res.status(404).send({ message: "Worker role not found." });
    if (!canManageOrg(req, role.orgId)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    res.send(role);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const orgId = resolveOrgId(req, req.body.orgId ?? req.body.organizationId);
    if (!orgId) {
      return res.status(400).send({ message: "Organization is required." });
    }
    if (!canManageOrg(req, orgId)) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const payload = pickPayload(req.body);
    if (!payload.name) {
      return res.status(400).send({ message: "Name is required." });
    }
    if (payload.status != null && !STATUSES.includes(payload.status)) {
      return res.status(400).send({ message: "Status must be active or inactive." });
    }
    const licenseRequired = payload.licenseRequired ?? false;
    const documentTypeId = licenseRequired ? payload.documentTypeId ?? null : null;
    if (documentTypeId != null) {
      const docType = await DocumentType.findByPk(documentTypeId);
      if (!docType) return res.status(400).send({ message: "Document type not found." });
    }

    const data = await WorkerRole.create({
      orgId,
      name: payload.name,
      description: payload.description ?? null,
      licenseRequired,
      documentTypeId,
      status: payload.status ?? "active",
    });
    res.send(await loadRole(data.id));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const role = await WorkerRole.findByPk(req.params.id);
    if (!role) return res.status(404).send({ message: "Worker role not found." });
    if (!canManageOrg(req, role.orgId)) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const payload = pickPayload(req.body);
    if (Object.prototype.hasOwnProperty.call(payload, "name") && !payload.name) {
      return res.status(400).send({ message: "Name is required." });
    }
    if (payload.status != null && !STATUSES.includes(payload.status)) {
      return res.status(400).send({ message: "Status must be active or inactive." });
    }
    const licenseRequired = Object.prototype.hasOwnProperty.call(payload, "licenseRequired")
      ? payload.licenseRequired
      : role.licenseRequired;
    if (!licenseRequired) {
      payload.documentTypeId = null;
    } else if (
      Object.prototype.hasOwnProperty.call(payload, "documentTypeId") &&
      payload.documentTypeId != null
    ) {
      const docType = await DocumentType.findByPk(payload.documentTypeId);
      if (!docType) return res.status(400).send({ message: "Document type not found." });
    }

    await role.update(payload);
    res.send(await loadRole(role.id));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const role = await WorkerRole.findByPk(req.params.id);
    if (!role) return res.status(404).send({ message: "Worker role not found." });
    if (!canManageOrg(req, role.orgId)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    await role.destroy();
    res.send({ message: "Worker role deleted." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
