import db from "../models/index.js";
import {
  ROLE_PENDING_USER,
  ROLE_TRIP_APPLICANT,
} from "../authorization/accessControl.js";

const Trip = db.trip;
const TripWorkerRole = db.tripWorkerRole;
const TripPeopleRole = db.tripPeopleRole;
const WorkerRole = db.workerRole;
const Role = db.role;
const Op = db.Sequelize.Op;

const LICENSE_STATUSES = ["yes", "yes_retired", "no"];

const orgInclude = {
  model: db.organization,
  as: "organization",
  attributes: ["id", "name", "logo", "colorFamily", "websiteUrl"],
};

const workerRoleInclude = {
  model: WorkerRole,
  as: "workerRole",
  attributes: ["id", "name", "description", "licenseRequired", "documentTypeId", "status"],
  include: [
    { model: db.documentType, as: "documentType", attributes: ["id", "description", "type"] },
  ],
};

const canBrowseOrg = (req, orgId) => {
  if (!req.user) return false;
  if (orgId == null || orgId === "") return false;
  return true;
};

const signedUpCountsByTripWorkerRoleId = async (tripId) => {
  const rows = await TripPeopleRole.findAll({
    attributes: [
      "tripWorkerRoleId",
      [db.sequelize.fn("COUNT", db.sequelize.col("id")), "signedUpCount"],
    ],
    where: {
      tripId,
      tripWorkerRoleId: { [Op.ne]: null },
    },
    group: ["tripWorkerRoleId"],
    raw: true,
  });
  return new Map(rows.map((r) => [Number(r.tripWorkerRoleId), Number(r.signedUpCount) || 0]));
};

const loadTripRolesNeeded = async (tripId) => {
  const rows = await TripWorkerRole.findAll({
    where: { tripId },
    include: [workerRoleInclude],
    order: [[{ model: WorkerRole, as: "workerRole" }, "name", "ASC"]],
  });
  const counts = await signedUpCountsByTripWorkerRoleId(tripId);
  return rows.map((row) => {
    const json = row.toJSON();
    const signedUpCount = counts.get(Number(json.id)) || 0;
    const quantity = Number(json.quantity) || 0;
    return {
      ...json,
      signedUpCount,
      availableCount: Math.max(0, quantity - signedUpCount),
    };
  });
};

const getPersonAssignment = async (tripId, peopleId) => {
  if (!peopleId) return null;
  return TripPeopleRole.findOne({
    where: { tripId, peopleId },
    include: [{ model: Role, as: "role", attributes: ["id", "roleName"] }],
  });
};

const parseBool = (value) => value === true || value === 1 || value === "1" || value === "true";

const exports = {};

exports.listBrowseOrgs = async (req, res) => {
  try {
    const orgs = await db.organization.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });
    res.send(orgs);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.listActiveTrips = async (req, res) => {
  try {
    const orgId = req.query.orgId;
    if (!orgId) return res.status(400).send({ message: "orgId is required." });
    if (!canBrowseOrg(req, orgId)) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const trips = await Trip.findAll({
      where: { orgId, status: "active" },
      include: [orgInclude],
      order: [
        ["startDate", "ASC"],
        ["name", "ASC"],
      ],
    });

    const peopleId = req.user?.personId;
    const tripIds = trips.map((t) => t.id);
    let assignmentByTripId = new Map();
    if (peopleId && tripIds.length) {
      const links = await TripPeopleRole.findAll({
        where: { tripId: tripIds, peopleId },
        attributes: ["id", "tripId", "status"],
      });
      assignmentByTripId = new Map(links.map((l) => [Number(l.tripId), l]));
    }

    res.send(
      trips.map((trip) => {
        const assignment = assignmentByTripId.get(Number(trip.id));
        return {
          ...trip.toJSON(),
          alreadyApplied: !!assignment,
          applicationStatus: assignment?.status || null,
        };
      })
    );
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.getBrowseTrip = async (req, res) => {
  try {
    const trip = await Trip.findByPk(req.params.id, { include: [orgInclude] });
    if (!trip || trip.status !== "active") {
      return res.status(404).send({ message: "Trip not found." });
    }
    if (!canBrowseOrg(req, trip.orgId)) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const rolesNeeded = await loadTripRolesNeeded(trip.id);
    const assignment = await getPersonAssignment(trip.id, req.user?.personId);

    res.send({
      trip,
      rolesNeeded,
      alreadyApplied: !!assignment,
      applicationStatus: assignment?.status || null,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.applyToTrip = async (req, res) => {
  try {
    const peopleId = req.user?.personId;
    if (!peopleId) {
      return res.status(400).send({ message: "Your account is not linked to a person profile." });
    }

    const trip = await Trip.findByPk(req.params.id, { include: [orgInclude] });
    if (!trip || trip.status !== "active") {
      return res.status(404).send({ message: "Trip not found." });
    }
    if (!canBrowseOrg(req, trip.orgId)) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const existing = await TripPeopleRole.findOne({ where: { tripId: trip.id, peopleId } });
    if (existing) {
      return res.status(409).send({
        message:
          existing.status === "active"
            ? "You are already on this trip."
            : "You have already applied to this trip.",
        alreadyApplied: true,
        applicationStatus: existing.status,
      });
    }

    const tripWorkerRoleId =
      req.body?.tripWorkerRoleId != null && req.body.tripWorkerRoleId !== ""
        ? Number(req.body.tripWorkerRoleId)
        : null;
    if (!tripWorkerRoleId) {
      return res.status(400).send({ message: "A trip role with available positions is required." });
    }

    const rolesNeeded = await loadTripRolesNeeded(trip.id);
    const selectedRole = rolesNeeded.find((r) => Number(r.id) === tripWorkerRoleId);
    if (!selectedRole) {
      return res.status(400).send({ message: "Worker role must belong to this trip." });
    }
    if ((selectedRole.availableCount || 0) < 1) {
      return res.status(400).send({ message: "That trip role has no available positions." });
    }

    const willSelfFund = parseBool(req.body?.willSelfFund);
    const willRaiseFunds = parseBool(req.body?.willRaiseFunds);
    if (!willSelfFund && !willRaiseFunds) {
      return res
        .status(400)
        .send({ message: "Select whether you will self-fund and/or raise funds." });
    }

    const licenseRequired = !!selectedRole.workerRole?.licenseRequired;
    let licenseStatus = null;
    if (licenseRequired) {
      licenseStatus = req.body?.licenseStatus || null;
      if (!LICENSE_STATUSES.includes(licenseStatus)) {
        return res
          .status(400)
          .send({ message: "License status is required for this role (Yes, Yes retired, or No)." });
      }
    }

    const hasPreferredRoommate = parseBool(req.body?.hasPreferredRoommate);
    const preferredRoommateNames = hasPreferredRoommate
      ? String(req.body?.preferredRoommateNames || "").trim() || null
      : null;
    if (hasPreferredRoommate && !preferredRoommateNames) {
      return res.status(400).send({ message: "Enter preferred roommate name(s)." });
    }

    let applicantRole = await Role.findOne({ where: { roleName: ROLE_TRIP_APPLICANT } });
    if (!applicantRole) {
      applicantRole = await Role.create({
        roleName: ROLE_TRIP_APPLICANT,
        roleDescription: "Applied to a trip; awaiting approval",
      });
    }

    const link = await TripPeopleRole.create({
      tripId: trip.id,
      peopleId,
      roleId: applicantRole.id,
      tripWorkerRoleId,
      status: "inactive",
      participantCost: trip.participantCost,
      willSelfFund,
      willRaiseFunds,
      licenseStatus,
      hasPreferredRoommate,
      preferredRoommateNames,
      assiginmentDateTime: new Date(),
    });

    const pendingRole = await Role.findOne({ where: { roleName: ROLE_PENDING_USER } });
    if (pendingRole) {
      const orgLink = await db.orgPeopleRole.findOne({
        where: { orgId: trip.orgId, peopleId },
      });
      if (!orgLink) {
        await db.orgPeopleRole.create({
          orgId: trip.orgId,
          peopleId,
          roleId: pendingRole.id,
        });
      }
    }

    res.send({
      message: "Application submitted. Your organization will review it.",
      assignment: link,
      alreadyApplied: true,
      applicationStatus: "inactive",
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
