import db from "../models/index.js";
import path from "path";
import fs from "fs";
import { canAccessOrg, isOrgAdminForOrg, isSystemAdmin, peopleListOrgIds, ROLE_TRIP_LEADER } from "../authorization/accessControl.js";
import { optimisticUpdate } from "../utils/optimisticUpdate.js";
import {
  normalizeEmail,
  findUserByEmail,
  findPersonByEmail,
  findPersonForUser,
  ensureUserForEmail,
  updateUserPassword,
  upsertPersonForUser,
  ensureOrgPeopleRole,
  resolveLinkedUser,
  linkPersonToUser,
} from "../utils/userPerson.js";

const Person = db.person;
const User = db.user;
const Session = db.session;
const OrgPeopleRole = db.orgPeopleRole;
const TripPeopleRole = db.tripPeopleRole;
const Trip = db.trip;
const Op = db.Sequelize.Op;
const exports = {};

const personFields = [
  "firstName",
  "lastName",
  "email",
  "addLine1",
  "addLine2",
  "city",
  "country",
  "state_prov",
  "postalCode",
  "phoneContryCode",
  "phoneNumber",
  "birthDate",
  "gender",
  "emergencyContactName",
  "emergencyContactPhoneCountryCode",
  "emergencyContactPhoneNumber",
  "hasAllergies",
  "allergiesDescription",
  "takesMedication",
  "currentChurchHome",
  "currentChurchHomeCity",
  "currentChurchHomeStateProv",
  "bioText",
  "userId",
];

const validatePersonFields = (data) => {
  if (
    Object.prototype.hasOwnProperty.call(data, "gender") &&
    data.gender != null &&
    data.gender !== "" &&
    !["male", "female"].includes(data.gender)
  ) {
    return "Gender must be male or female.";
  }
  return null;
};

exports.findAll = async (req, res) => {
  try {
    const orgIds = peopleListOrgIds(req);
    if (orgIds == null) return res.send([]);

    const linkWhere = orgIds === "all" ? {} : { orgId: orgIds };
    const links = await OrgPeopleRole.findAll({ where: linkWhere });
    let peopleIds = [...new Set(links.map((l) => l.peopleId))];

    const tripIdRaw = req.query.tripId;
    if (tripIdRaw != null && tripIdRaw !== "") {
      const tripId = parseInt(tripIdRaw, 10);
      if (Number.isNaN(tripId)) {
        return res.status(400).send({ message: "Invalid tripId." });
      }
      const trip = await Trip.findByPk(tripId, { attributes: ["id", "orgId"] });
      if (!trip) return res.send([]);
      if (orgIds !== "all" && !orgIds.includes(Number(trip.orgId))) {
        return res.send([]);
      }
      const tripLinks = await TripPeopleRole.findAll({ where: { tripId }, attributes: ["peopleId"] });
      const tripPeopleIds = new Set(tripLinks.map((l) => l.peopleId));
      peopleIds = peopleIds.filter((id) => tripPeopleIds.has(id));
    }

    if (!peopleIds.length) return res.send([]);

    const data = await Person.findAll({
      where: { id: peopleIds },
      order: [["lastName", "ASC"], ["firstName", "ASC"]],
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.findOrgTripLeaders = async (req, res) => {
  try {
    const orgId = parseInt(req.query.orgId, 10);
    if (Number.isNaN(orgId)) {
      return res.status(400).send({ message: "orgId is required." });
    }
    if (!isSystemAdmin(req) && !isOrgAdminForOrg(req, orgId) && !canAccessOrg(req, orgId)) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const role = await db.role.findOne({ where: { roleName: ROLE_TRIP_LEADER } });
    if (!role) return res.send([]);

    const links = await OrgPeopleRole.findAll({
      where: { orgId, roleId: role.id },
      include: [
        {
          model: Person,
          as: "person",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
    });

    const byId = new Map();
    for (const link of links) {
      if (link.person) byId.set(link.person.id, link.person);
    }

    const data = [...byId.values()].sort((a, b) => {
      const last = (a.lastName || "").localeCompare(b.lastName || "");
      return last !== 0 ? last : (a.firstName || "").localeCompare(b.firstName || "");
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const canManagePerson = async (req, personId) => {
  if (isSystemAdmin(req)) return true;
  if (req.user?.personId && Number(req.user.personId) === Number(personId)) return true;
  const orgIds = (req.user.orgRoles || [])
    .filter((r) => r.role?.roleName === "Org Admin")
    .map((r) => r.orgId);
  if (!orgIds.length) return false;
  const link = await OrgPeopleRole.findOne({
    where: { peopleId: personId, orgId: { [Op.in]: orgIds } },
  });
  return !!link;
};

exports.findOne = async (req, res) => {
  try {
    const person = await Person.findByPk(req.params.id);
    if (!person) return res.status(404).send({ message: "Person not found." });
    if (!(await canManagePerson(req, person.id))) {
      return res.status(404).send({ message: "Person not found." });
    }
    const payload = person.toJSON();
    if (isSystemAdmin(req)) {
      const linkedUser = await resolveLinkedUser(person);
      if (linkedUser) {
        await linkPersonToUser(person, linkedUser);
        payload.userId = linkedUser.id;
        payload.isAdmin = !!linkedUser.isAdmin;
      } else {
        payload.isAdmin = false;
      }
    }
    res.send(payload);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { orgId: bodyOrgId, roleId, password, isAdmin, ...personData } = req.body;
    const validationError = validatePersonFields(personData);
    if (validationError) return res.status(400).send({ message: validationError });
    let orgId = bodyOrgId != null && bodyOrgId !== "" ? parseInt(bodyOrgId, 10) : null;

    if (!isSystemAdmin(req)) {
      const adminOrgs = (req.user.orgRoles || []).filter((r) => r.role?.roleName === "Org Admin");
      if (!orgId && adminOrgs.length === 1) {
        orgId = adminOrgs[0].orgId;
      }
      if (!orgId || !isOrgAdminForOrg(req, orgId)) {
        return res.status(403).send({ message: "Forbidden." });
      }
    }

    if (orgId && !roleId) {
      return res.status(400).send({ message: "Role is required when adding a person to an organization." });
    }

    const emailNorm = normalizeEmail(personData.email);
    let person;

    if (emailNorm) {
      const existingUser = await findUserByEmail(emailNorm);
      const existingPerson = existingUser
        ? await findPersonForUser(existingUser.id)
        : await findPersonByEmail(emailNorm);
      const isExisting = !!(existingUser || existingPerson);

      let linkedUser = existingUser;
      if (!linkedUser) {
        linkedUser = await ensureUserForEmail(emailNorm, password);
      } else if (password && password.length >= 8) {
        await updateUserPassword(linkedUser.id, password);
      }

      if (isSystemAdmin(req) && Object.prototype.hasOwnProperty.call(req.body, "isAdmin")) {
        await User.update({ isAdmin: !!isAdmin }, { where: { id: linkedUser.id } });
      }

      person = await upsertPersonForUser(
        linkedUser,
        {
          firstName: personData.firstName,
          lastName: personData.lastName,
          emailNorm,
          addLine1: personData.addLine1,
          addLine2: personData.addLine2,
          city: personData.city,
          country: personData.country,
          state_prov: personData.state_prov,
          postalCode: personData.postalCode,
          phoneContryCode: personData.phoneContryCode,
          phoneNumber: personData.phoneNumber,
          birthDate: personData.birthDate,
          gender: personData.gender,
          emergencyContactName: personData.emergencyContactName,
          emergencyContactPhoneCountryCode: personData.emergencyContactPhoneCountryCode,
          emergencyContactPhoneNumber: personData.emergencyContactPhoneNumber,
          hasAllergies: personData.hasAllergies,
          allergiesDescription: personData.allergiesDescription,
          takesMedication: personData.takesMedication,
          currentChurchHome: personData.currentChurchHome,
          currentChurchHomeCity: personData.currentChurchHomeCity,
          currentChurchHomeStateProv: personData.currentChurchHomeStateProv,
          bioText: personData.bioText,
        },
        { mergeOptional: isExisting }
      );

      let orgRoleResult = null;
      if (orgId) {
        orgRoleResult = await ensureOrgPeopleRole(orgId, person.id, roleId);
      }

      const message = isExisting
        ? orgRoleResult?.created
          ? "Existing person updated and assigned to the organization."
          : "Existing person updated."
        : "Person created.";

      return res.send({
        person,
        existingPerson: isExisting,
        orgRoleCreated: !!orgRoleResult?.created,
        message,
      });
    } else {
      person = await Person.create(personData);
    }

    if (orgId) {
      await ensureOrgPeopleRole(orgId, person.id, roleId);
    }

    res.send({ person, existingPerson: false, message: "Person created." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const person = await Person.findByPk(req.params.id);
    if (!person) return res.status(404).send({ message: "Person not found." });
    if (!(await canManagePerson(req, person.id))) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const body = { ...req.body };
    const validationError = validatePersonFields(body);
    if (validationError) return res.status(400).send({ message: validationError });

    if (Object.prototype.hasOwnProperty.call(body, "email") && person.userId) {
      const newEmail = body.email?.trim()?.toLowerCase() || "";
      if (!newEmail) {
        return res.status(400).send({ message: "Email is required for a person linked to a user account." });
      }
      const currentEmail = person.email?.trim()?.toLowerCase() || "";
      if (newEmail !== currentEmail) {
        const existing = await User.unscoped().findOne({ where: { email: newEmail } });
        if (existing && existing.id !== person.userId) {
          return res.status(409).send({ message: "Email already in use by another user." });
        }
        await User.update({ email: newEmail }, { where: { id: person.userId } });
        await Session.update({ email: newEmail }, { where: { userId: person.userId } });
      }
      body.email = newEmail;
    } else if (Object.prototype.hasOwnProperty.call(body, "email") && body.email) {
      body.email = body.email.trim().toLowerCase();
    }

    if (Object.prototype.hasOwnProperty.call(body, "isAdmin")) {
      if (!isSystemAdmin(req)) {
        return res.status(403).send({ message: "Forbidden. System admin required to change admin status." });
      }
      let linkedUser = await resolveLinkedUser(person);
      if (!linkedUser) {
        const emailNorm = normalizeEmail(body.email || person.email);
        if (!emailNorm) {
          return res.status(400).send({ message: "Email is required to set system administrator status." });
        }
        linkedUser = await ensureUserForEmail(emailNorm);
      }
      await linkPersonToUser(person, linkedUser);
      await User.update({ isAdmin: !!body.isAdmin }, { where: { id: linkedUser.id } });
      delete body.isAdmin;
    }

    if (Object.prototype.hasOwnProperty.call(body, "password") && body.password) {
      const isSelf = req.user?.personId && Number(req.user.personId) === Number(person.id);
      if (isSelf) {
        return res.status(400).send({
          message: "Use the current password fields to change your own password.",
        });
      }
      if (body.password.length < 8) {
        return res.status(400).send({ message: "Password must be at least 8 characters." });
      }
      let linkedUser = await resolveLinkedUser(person);
      if (!linkedUser) {
        return res.status(400).send({ message: "No user account is linked to this person." });
      }
      await updateUserPassword(linkedUser.id, body.password);
      delete body.password;
    }

    const result = await optimisticUpdate(Person, req.params.id, body, personFields);
    if (!result.ok) return res.status(result.status).send({ message: result.message });
    res.send(result.data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.uploadPicture = async (req, res) => {
  try {
    const person = await Person.findByPk(req.params.id);
    if (!person) return res.status(404).send({ message: "Person not found." });
    if (!(await canManagePerson(req, person.id))) {
      return res.status(403).send({ message: "Forbidden." });
    }
    if (!req.file) return res.status(400).send({ message: "No picture uploaded." });

    if (person.picture) {
      for (const filePath of [
        path.join("images", person.picture),
        path.join("uploads", person.picture),
      ]) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          /* ignore missing previous file */
        }
      }
    }

    const picture = path.join("people", req.file.filename).replace(/\\/g, "/");
    await Person.update({ picture }, { where: { id: req.params.id } });
    res.send({ message: "Picture uploaded.", picture });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    if (!isSystemAdmin(req)) return res.status(403).send({ message: "Forbidden." });
    const num = await Person.destroy({ where: { id: req.params.id } });
    if (num === 1) res.send({ message: "Person deleted." });
    else res.status(404).send({ message: "Person not found." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
