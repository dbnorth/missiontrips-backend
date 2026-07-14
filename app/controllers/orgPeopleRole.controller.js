import db from "../models/index.js";
import { canAccessOrg, isOrgAdminForOrg, isSystemAdmin } from "../authorization/accessControl.js";
import { optimisticUpdate } from "../utils/optimisticUpdate.js";
import { ensureOrgPeopleRole } from "../utils/userPerson.js";

const OrgPeopleRole = db.orgPeopleRole;
const fields = ["orgId", "peopleId", "roleId"];

const exports = {};

exports.findAll = async (req, res) => {
  try {
    const { orgId, peopleId } = req.query;
    const include = [
      { model: db.organization, as: "organization", attributes: ["id", "name"] },
      { model: db.role, as: "role", attributes: ["id", "roleName"] },
    ];

    if (peopleId) {
      if (!isSystemAdmin(req)) {
        return res.status(403).send({ message: "Forbidden." });
      }
      const personId = parseInt(peopleId, 10);
      if (Number.isNaN(personId)) {
        return res.status(400).send({ message: "Invalid peopleId." });
      }
      const data = await OrgPeopleRole.findAll({
        where: { peopleId: personId },
        include,
        order: [["orgId", "ASC"]],
      });
      return res.send(data);
    }

    if (!orgId) return res.status(400).send({ message: "orgId or peopleId query param required." });
    if (!canAccessOrg(req, orgId)) return res.status(403).send({ message: "Forbidden." });
    const data = await OrgPeopleRole.findAll({
      where: { orgId },
      include: [
        { model: db.person, as: "person" },
        { model: db.role, as: "role" },
      ],
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const orgId = parseInt(req.body.orgId, 10);
    const peopleId = parseInt(req.body.peopleId, 10);
    const roleId = parseInt(req.body.roleId, 10);
    if (Number.isNaN(orgId) || Number.isNaN(peopleId) || Number.isNaN(roleId)) {
      return res.status(400).send({ message: "orgId, peopleId, and roleId are required." });
    }
    if (!isOrgAdminForOrg(req, orgId) && !isSystemAdmin(req)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const person = await db.person.findByPk(peopleId);
    if (!person) return res.status(404).send({ message: "Person not found." });

    const result = await ensureOrgPeopleRole(orgId, peopleId, roleId);
    const data = await OrgPeopleRole.findByPk(result.link.id, {
      include: [
        { model: db.organization, as: "organization", attributes: ["id", "name"] },
        { model: db.role, as: "role", attributes: ["id", "roleName"] },
      ],
    });
    res.send({
      ...data.toJSON(),
      created: result.created,
      roleUpdated: result.roleUpdated,
      message: result.created ? "Organization role added." : "Organization role already assigned.",
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await OrgPeopleRole.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Record not found." });
    if (!isOrgAdminForOrg(req, row.orgId) && !isSystemAdmin(req)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const result = await optimisticUpdate(OrgPeopleRole, req.params.id, req.body, fields);
    if (!result.ok) return res.status(result.status).send({ message: result.message });
    res.send(result.data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const row = await OrgPeopleRole.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Record not found." });
    if (!isOrgAdminForOrg(req, row.orgId) && !isSystemAdmin(req)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    await OrgPeopleRole.destroy({ where: { id: req.params.id } });
    res.send({ message: "Deleted." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
