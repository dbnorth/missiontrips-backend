import db from "../models/index.js";
import {
  canAccessTrip,
  isOrgAdminForOrg,
  isSystemAdmin,
  isTripLeaderForTrip,
} from "../authorization/accessControl.js";
import { optimisticUpdate } from "../utils/optimisticUpdate.js";

const TripPeopleRole = db.tripPeopleRole;
const Trip = db.trip;
const TripDonation = db.tripDonation;
const TripWorkerRole = db.tripWorkerRole;
const Op = db.Sequelize.Op;
const fields = [
  "tripId",
  "peopleId",
  "roleId",
  "tripWorkerRoleId",
  "status",
  "participantCost",
  "whygoText",
  "willSelfFund",
  "willRaiseFunds",
  "licenseStatus",
  "hasPreferredRoommate",
  "preferredRoommateNames",
  "assiginmentDateTime",
];

const listIncludes = [
  { model: db.person, as: "person" },
  { model: db.role, as: "role" },
  {
    model: TripWorkerRole,
    as: "tripWorkerRole",
    include: [
      {
        model: db.workerRole,
        as: "workerRole",
        attributes: ["id", "name", "description", "licenseRequired", "documentTypeId", "status"],
        include: [
          { model: db.documentType, as: "documentType", attributes: ["id", "description", "type"] },
        ],
      },
    ],
  },
];

const exports = {};

const canManageTripPeople = async (req, tripId) => {
  const access = await canAccessTrip(req, tripId);
  if (!access.ok) return false;
  if (isOrgAdminForOrg(req, access.trip.orgId) || isSystemAdmin(req)) return true;
  return isTripLeaderForTrip(req, tripId);
};

const normalizeTripWorkerRoleId = (value) => {
  if (value == null || value === "") return null;
  return Number(value);
};

const validateTripWorkerRole = async (tripId, tripWorkerRoleId) => {
  if (tripWorkerRoleId == null) return { ok: true, tripWorkerRoleId: null };
  const row = await TripWorkerRole.findByPk(tripWorkerRoleId, { attributes: ["id", "tripId"] });
  if (!row) return { ok: false, status: 400, message: "Trip worker role not found." };
  if (Number(row.tripId) !== Number(tripId)) {
    return { ok: false, status: 400, message: "Worker role must belong to this trip." };
  }
  return { ok: true, tripWorkerRoleId: row.id };
};

exports.findAll = async (req, res) => {
  try {
    const tripId = req.query.tripId;
    if (!tripId) return res.status(400).send({ message: "tripId query param required." });
    if (!(await canManageTripPeople(req, tripId)) && !(await canAccessTrip(req, tripId)).ok) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const data = await TripPeopleRole.findAll({
      where: { tripId },
      include: listIncludes,
    });

    const totals = await TripDonation.findAll({
      attributes: ["personId", [db.sequelize.fn("SUM", db.sequelize.col("amount")), "donationTotal"]],
      where: { tripId, personId: { [Op.ne]: null } },
      group: ["personId"],
      raw: true,
    });
    const totalsByPersonId = new Map(
      totals.map((row) => [Number(row.personId), Number(row.donationTotal) || 0])
    );

    res.send(
      data.map((row) => ({
        ...row.toJSON(),
        donationTotal: totalsByPersonId.get(Number(row.peopleId)) || 0,
      }))
    );
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    if (!(await canManageTripPeople(req, req.body.tripId))) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const payload = { ...req.body };
    payload.tripWorkerRoleId = normalizeTripWorkerRoleId(payload.tripWorkerRoleId);
    const twrCheck = await validateTripWorkerRole(payload.tripId, payload.tripWorkerRoleId);
    if (!twrCheck.ok) return res.status(twrCheck.status).send({ message: twrCheck.message });
    payload.tripWorkerRoleId = twrCheck.tripWorkerRoleId;

    if (payload.participantCost == null || payload.participantCost === "") {
      const trip = await Trip.findByPk(payload.tripId, { attributes: ["participantCost"] });
      if (trip?.participantCost != null) {
        payload.participantCost = trip.participantCost;
      }
    }
    const data = await TripPeopleRole.create(payload);
    const full = await TripPeopleRole.findByPk(data.id, { include: listIncludes });
    res.send(full);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await TripPeopleRole.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Record not found." });
    if (!(await canManageTripPeople(req, row.tripId))) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const body = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(body, "tripWorkerRoleId")) {
      body.tripWorkerRoleId = normalizeTripWorkerRoleId(body.tripWorkerRoleId);
      const twrCheck = await validateTripWorkerRole(row.tripId, body.tripWorkerRoleId);
      if (!twrCheck.ok) return res.status(twrCheck.status).send({ message: twrCheck.message });
      body.tripWorkerRoleId = twrCheck.tripWorkerRoleId;
    }

    const result = await optimisticUpdate(TripPeopleRole, req.params.id, body, fields);
    if (!result.ok) return res.status(result.status).send({ message: result.message });
    const full = await TripPeopleRole.findByPk(req.params.id, { include: listIncludes });
    res.send(full);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const row = await TripPeopleRole.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Record not found." });
    if (!(await canManageTripPeople(req, row.tripId))) {
      return res.status(403).send({ message: "Forbidden." });
    }
    await TripPeopleRole.destroy({ where: { id: req.params.id } });
    res.send({ message: "Deleted." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
