import db from "../models/index.js";
import { Op } from "sequelize";
import {
  isOrgAdminForOrg,
  isSystemAdmin,
  isTripLeaderForTrip,
  parseOrganizationScopeHeader,
  ROLE_ORG_ADMIN,
  ROLE_TRIP_LEADER,
} from "../authorization/accessControl.js";

const EmailTemplate = db.emailTemplate;
const Trip = db.trip;
const Organization = db.organization;
const templateFields = ["tripId", "fromEmail", "functionCode", "subject", "content", "attachment"];

const getOrgAdminOrgIds = (req) => [
  ...new Set(
    (req.user?.orgRoles || [])
      .filter((r) => r.role?.roleName === ROLE_ORG_ADMIN)
      .map((r) => Number(r.orgId))
  ),
];

const getTripLeaderTripIds = (req, orgId = null) => {
  const roles = (req.user?.tripRoles || []).filter(
    (r) => r.role?.roleName === ROLE_TRIP_LEADER && r.status === "active"
  );
  const ids = roles
    .filter((r) => {
      if (orgId == null || orgId === "") return true;
      const tripOrgId = r.trip?.orgId;
      return tripOrgId != null && Number(tripOrgId) === Number(orgId);
    })
    .map((r) => Number(r.tripId));
  return [...new Set(ids)];
};

const resolveTemplateOrgId = (req, bodyOrgId) => {
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

const resolveCreateOrgId = (req) => {
  if (Object.prototype.hasOwnProperty.call(req.body, "orgId")) {
    const raw = req.body.orgId;
    if (raw == null || raw === "") {
      if (!isSystemAdmin(req)) return { error: { status: 403, message: "Forbidden." } };
      return { orgId: null };
    }
    return { orgId: Number(raw) };
  }
  const orgId = resolveTemplateOrgId(req);
  if (orgId == null && !isSystemAdmin(req)) {
    return { error: { status: 400, message: "Organization is required." } };
  }
  return { orgId };
};

const canManageTemplate = (req, template) => {
  if (template.orgId == null) return isSystemAdmin(req);
  if (isOrgAdminForOrg(req, template.orgId)) return true;
  if (template.tripId != null && isTripLeaderForTrip(req, template.tripId)) return true;
  return false;
};

const loadTemplate = (id) =>
  EmailTemplate.findByPk(id, {
    include: [
      { model: Trip, as: "trip", attributes: ["id", "name", "orgId"] },
      { model: Organization, attributes: ["id", "name"] },
    ],
  });

const validateTripForOrg = async (tripId, orgId) => {
  if (tripId == null || tripId === "") return { ok: true, tripId: null };
  if (orgId == null) {
    return { ok: false, status: 400, message: "Trip cannot be set on a global template." };
  }
  const trip = await Trip.findByPk(tripId, { attributes: ["id", "orgId"] });
  if (!trip) return { ok: false, status: 400, message: "Trip not found." };
  if (Number(trip.orgId) !== Number(orgId)) {
    return { ok: false, status: 400, message: "Trip must belong to the selected organization." };
  }
  return { ok: true, tripId: trip.id };
};

const pickTemplatePayload = (body) => {
  const payload = {};
  for (const key of templateFields) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const val = body[key];
    if (key === "tripId") {
      payload.tripId = val == null || val === "" ? null : Number(val);
    } else if (typeof val === "string") {
      payload[key] = val.trim() || null;
    } else {
      payload[key] = val ?? null;
    }
  }
  return payload;
};

const listIncludes = [
  { model: Trip, attributes: ["id", "name", "orgId"] },
  { model: Organization, attributes: ["id", "name"] },
];

const copySourceAttributes = ["id", "functionCode", "fromEmail", "subject", "content", "attachment"];

const hasFunctionCode = {
  functionCode: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
};

const exports = {};

exports.findAll = async (req, res) => {
  try {
    const orgId = resolveTemplateOrgId(req);
    let leaderTripIds = getTripLeaderTripIds(req, orgId);

    if (isSystemAdmin(req) && orgId == null) {
      const data = await EmailTemplate.findAll({
        where: { orgId: null },
        include: listIncludes,
        order: [
          ["functionCode", "ASC"],
          ["subject", "ASC"],
        ],
      });
      return res.send(data);
    }

    if (orgId && isOrgAdminForOrg(req, orgId)) {
      const data = await EmailTemplate.findAll({
        where: { orgId },
        include: listIncludes,
        order: [
          ["functionCode", "ASC"],
          ["subject", "ASC"],
        ],
      });
      return res.send(data);
    }

    if (leaderTripIds.length) {
      const queryTripId = req.query.tripId;
      let where = { tripId: { [Op.in]: leaderTripIds } };
      if (queryTripId != null && queryTripId !== "") {
        const id = Number(queryTripId);
        if (!leaderTripIds.includes(id)) {
          return res.status(403).send({ message: "Forbidden." });
        }
        where = { tripId: id };
      }

      const data = await EmailTemplate.findAll({
        where,
        include: listIncludes,
        order: [
          ["functionCode", "ASC"],
          ["subject", "ASC"],
        ],
      });
      return res.send(data);
    }

    if (!orgId) return res.send([]);
    return res.status(403).send({ message: "Forbidden." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const template = await loadTemplate(req.params.id);
    if (!template) return res.status(404).send({ message: "Template not found." });
    if (!canManageTemplate(req, template)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    res.send(template);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.copySources = async (req, res) => {
  try {
    const orgId = resolveTemplateOrgId(req);
    const tripId = req.query.tripId;

    if (tripId == null || tripId === "") {
      const data = await EmailTemplate.findAll({
        where: { orgId: null, ...hasFunctionCode },
        attributes: copySourceAttributes,
        order: [
          ["functionCode", "ASC"],
          ["subject", "ASC"],
        ],
      });
      return res.send(data);
    }

    if (!orgId) {
      return res.status(400).send({ message: "Organization is required." });
    }
    const tripIdNum = Number(tripId);
    const canUseOrgSources =
      isOrgAdminForOrg(req, orgId) || isTripLeaderForTrip(req, tripIdNum);
    if (!canUseOrgSources) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const data = await EmailTemplate.findAll({
      where: { orgId, tripId: null, ...hasFunctionCode },
      attributes: copySourceAttributes,
      order: [
        ["functionCode", "ASC"],
        ["subject", "ASC"],
      ],
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const resolved = resolveCreateOrgId(req);
    if (resolved.error) {
      return res.status(resolved.error.status).send({ message: resolved.error.message });
    }
    let { orgId } = resolved;
    const tripId =
      req.body.tripId != null && req.body.tripId !== "" ? Number(req.body.tripId) : null;

    const isOrgAdmin = orgId != null && isOrgAdminForOrg(req, orgId);
    const isLeaderCreate = tripId != null && isTripLeaderForTrip(req, tripId);

    if (!isOrgAdmin && !isLeaderCreate) {
      return res.status(403).send({ message: "Forbidden." });
    }

    if (!req.body.subject?.trim()) {
      return res.status(400).send({ message: "Subject is required." });
    }

    if (isLeaderCreate && !isOrgAdmin) {
      const trip = await Trip.findByPk(tripId, { attributes: ["id", "orgId"] });
      if (!trip) return res.status(400).send({ message: "Trip not found." });
      orgId = trip.orgId;
    }

    const tripCheck = await validateTripForOrg(
      isLeaderCreate && !isOrgAdmin ? tripId : req.body.tripId,
      orgId
    );
    if (!tripCheck.ok) return res.status(tripCheck.status).send({ message: tripCheck.message });

    const payload = pickTemplatePayload(req.body);
    if (orgId == null) payload.tripId = null;
    if (isLeaderCreate && !isOrgAdmin) payload.tripId = tripId;

    const data = await EmailTemplate.create({ ...payload, orgId });
    res.send(await loadTemplate(data.id));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const template = await EmailTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).send({ message: "Template not found." });
    if (!canManageTemplate(req, template)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "subject") && !req.body.subject?.trim()) {
      return res.status(400).send({ message: "Subject is required." });
    }

    const tripId = Object.prototype.hasOwnProperty.call(req.body, "tripId")
      ? req.body.tripId
      : template.tripId;
    const tripCheck = await validateTripForOrg(tripId, template.orgId);
    if (!tripCheck.ok) return res.status(tripCheck.status).send({ message: tripCheck.message });

    const payload = pickTemplatePayload(req.body);
    if (template.orgId == null) payload.tripId = null;

    await template.update(payload);
    res.send(await loadTemplate(template.id));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const template = await EmailTemplate.findByPk(req.params.id);
    if (!template) return res.status(404).send({ message: "Template not found." });
    if (!canManageTemplate(req, template)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    await template.destroy();
    res.send({ message: "Template deleted." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
