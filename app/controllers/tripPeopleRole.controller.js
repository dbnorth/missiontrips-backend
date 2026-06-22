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
const Op = db.Sequelize.Op;
const fields = ["tripId", "peopleId", "roleId", "status", "whygoText", "assiginmentDateTime"];

const exports = {};

const canManageTripPeople = async (req, tripId) => {
  const access = await canAccessTrip(req, tripId);
  if (!access.ok) return false;
  if (isOrgAdminForOrg(req, access.trip.orgId) || isSystemAdmin(req)) return true;
  return isTripLeaderForTrip(req, tripId);
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
      include: [
        { model: db.person, as: "person" },
        { model: db.role, as: "role" },
      ],
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
    const data = await TripPeopleRole.create(req.body);
    res.send(data);
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
    const result = await optimisticUpdate(TripPeopleRole, req.params.id, req.body, fields);
    if (!result.ok) return res.status(result.status).send({ message: result.message });
    res.send(result.data);
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
