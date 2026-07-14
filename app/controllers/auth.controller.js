import db from "../models/index.js";
import authconfig from "../config/auth.config.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import logger from "../config/logger.js";
import { ROLE_PENDING_USER } from "../authorization/accessControl.js";
import {
  normalizeEmail,
  findUserByEmail,
  findPersonByEmail,
  findPersonForUser,
  ensureUserForEmail,
  applyRegistrationPassword,
  upsertPersonForUser,
  ensureOrgPeopleRole,
  updateUserPassword,
} from "../utils/userPerson.js";

const User = db.user;
const Session = db.session;
const Person = db.person;
const Organization = db.organization;
const OrgPeopleRole = db.orgPeopleRole;
const TripPeopleRole = db.tripPeopleRole;
const Role = db.role;
const Op = db.Sequelize.Op;

const SALT_ROUNDS = 10;
const SESSION_MS = authconfig.sessionHours * 60 * 60 * 1000;

const buildAuthPayload = async (user, token) => {
  const person = await Person.findOne({ where: { userId: user.id } });
  const orgRoles = person
    ? await OrgPeopleRole.findAll({
        where: { peopleId: person.id },
        include: [
          { model: db.organization, as: "organization", attributes: ["id", "name", "logo", "colorFamily"] },
          { model: Role, as: "role", attributes: ["id", "roleName"] },
        ],
      })
    : [];
  const tripRoles = person
    ? await TripPeopleRole.findAll({
        where: { peopleId: person.id, status: "active" },
        include: [
          {
            model: db.trip,
            as: "trip",
            attributes: ["id", "name", "orgId", "status"],
            include: [
              { model: Organization, as: "organization", attributes: ["id", "name", "logo", "colorFamily"] },
            ],
          },
          { model: Role, as: "role", attributes: ["id", "roleName"] },
        ],
      })
    : [];

  return {
    email: user.email,
    userId: user.id,
    token,
    isAdmin: user.isAdmin,
    personId: person?.id ?? null,
    firstName: person?.firstName ?? "",
    lastName: person?.lastName ?? "",
    orgRoles: orgRoles.map((r) => ({
      orgId: r.orgId,
      orgName: r.organization?.name,
      logo: r.organization?.logo,
      colorFamily: r.organization?.colorFamily,
      roleName: r.role?.roleName,
      roleId: r.roleId,
    })),
    tripRoles: tripRoles.map((r) => ({
      tripId: r.tripId,
      tripName: r.trip?.name,
      orgId: r.trip?.orgId,
      orgName: r.trip?.organization?.name,
      orgLogo: r.trip?.organization?.logo,
      orgColorFamily: r.trip?.organization?.colorFamily,
      tripStatus: r.trip?.status,
      roleName: r.role?.roleName,
      roleId: r.roleId,
    })),
  };
};

const sendAuthPayload = async (res, user, token) => {
  const payload = await buildAuthPayload(user, token);
  res.send(payload);
};

const createOrReuseSession = async (user, res) => {
  const email = user.email;

  const existing = await Session.findOne({
    where: { email, token: { [Op.ne]: "" } },
  });

  if (existing && existing.expirationDate >= Date.now()) {
    return sendAuthPayload(res, user, existing.token);
  }
  if (existing) {
    await Session.update({ token: "" }, { where: { id: existing.id } });
  }

  const token = jwt.sign({ id: email, sub: user.id }, authconfig.secret, {
    expiresIn: authconfig.sessionHours * 3600,
  });
  const expirationDate = new Date(Date.now() + SESSION_MS);

  await Session.create({ token, email, expirationDate, userId: user.id });
  await db.emailLog.create({
    toEmail: email,
    fromEmail: "system@missiontrips",
    subject: "Login",
    content: `User ${email} logged in at ${new Date().toISOString()}`,
    emailId: `login-${user.id}-${Date.now()}`,
  });
  sendAuthPayload(res, user, token);
};

const exports = {};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim() || !password) {
    return res.status(400).send({ message: "Email and password are required." });
  }
  const emailNorm = email.trim().toLowerCase();
  try {
    const user = await User.unscoped().findOne({
      where: { email: emailNorm },
      attributes: ["id", "email", "password", "isAdmin"],
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).send({ message: "Invalid email or password." });
    }
    await createOrReuseSession(user, res);
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    res.status(500).send({ message: err.message });
  }
};

exports.register = async (req, res) => {
  const { email, password, firstName, lastName, orgIds } = req.body;
  if (!email?.trim() || !password || !firstName?.trim() || !lastName?.trim()) {
    return res.status(400).send({ message: "First name, last name, email, and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).send({ message: "Password must be at least 8 characters." });
  }

  const emailNorm = normalizeEmail(email);
  try {
    const pendingRole = await Role.findOne({ where: { roleName: ROLE_PENDING_USER } });
    if (!pendingRole) {
      return res.status(500).send({ message: "Pending User role is not configured. Run npm run seed." });
    }

    const requestedOrgIds = [
      ...new Set(
        (Array.isArray(orgIds) ? orgIds : [])
          .map((id) => parseInt(id, 10))
          .filter((id) => !Number.isNaN(id))
      ),
    ];

    let user = await findUserByEmail(emailNorm);
    const existingPerson = user
      ? await findPersonForUser(user.id)
      : await findPersonByEmail(emailNorm);

    if (user || existingPerson) {
      if (!user) {
        user = await ensureUserForEmail(emailNorm, password);
      } else {
        const passwordResult = await applyRegistrationPassword(user.id, password);
        if (!passwordResult.ok) {
          return res.status(passwordResult.status).send({ message: passwordResult.message });
        }
      }

      const person = await upsertPersonForUser(user, {
        firstName,
        lastName,
        emailNorm,
      });

      for (const orgId of requestedOrgIds) {
        const org = await Organization.findByPk(orgId);
        if (!org) continue;
        await ensureOrgPeopleRole(orgId, person.id, pendingRole.id);
      }

      await createOrReuseSession(user, res);
      return;
    }

    user = await ensureUserForEmail(emailNorm, password);
    const person = await upsertPersonForUser(user, {
      firstName,
      lastName,
      emailNorm,
    });

    for (const orgId of requestedOrgIds) {
      const org = await Organization.findByPk(orgId);
      if (!org) continue;
      await ensureOrgPeopleRole(orgId, person.id, pendingRole.id);
    }

    await createOrReuseSession(user, res);
  } catch (err) {
    logger.error(`Register error: ${err.message}`);
    res.status(500).send({ message: err.message });
  }
};

exports.listOrganizationsForRegister = async (_req, res) => {
  try {
    const orgs = await Organization.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });
    res.send(orgs);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const rows = await Session.findAll({ where: { token: req.body?.token } });
    if (rows[0]) {
      await Session.update({ token: "" }, { where: { id: rows[0].id } });
    }
    res.send({ message: "User has been successfully logged out!" });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).send({ message: "User not found." });
    const payload = await buildAuthPayload(user, req.get("authorization")?.slice(7) || "");
    res.send(payload);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).send({ message: "Current password and new password are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).send({ message: "New password must be at least 8 characters." });
  }

  try {
    const user = await User.unscoped().findByPk(req.user.id, {
      attributes: ["id", "password"],
    });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).send({ message: "Current password is incorrect." });
    }
    await updateUserPassword(user.id, newPassword);
    res.send({ message: "Password updated." });
  } catch (err) {
    logger.error(`Change password error: ${err.message}`);
    res.status(500).send({ message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).send({ message: "Password reset is disabled in production." });
  }
  const { email, newPassword } = req.body;
  if (!email?.trim() || !newPassword || newPassword.length < 8) {
    return res.status(400).send({ message: "Email and new password (min 8 chars) are required." });
  }
  const emailNorm = email.trim().toLowerCase();
  try {
    const user = await User.unscoped().findOne({ where: { email: emailNorm } });
    if (!user) return res.status(404).send({ message: "User not found." });
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await User.update({ password: hash, passwordSetByUser: true }, { where: { id: user.id } });
    res.send({ message: "Password updated." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
