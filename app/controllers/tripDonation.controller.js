import db from "../models/index.js";
import {
  canAccessTrip,
  isOrgAdminForOrg,
  isSystemAdmin,
  isTripLeaderForTrip,
  isTripParticipantForTrip,
} from "../authorization/accessControl.js";
import { optimisticUpdate } from "../utils/optimisticUpdate.js";
import { normalizeEmail } from "../utils/userPerson.js";

const TripDonation = db.tripDonation;
const Donor = db.donor;
const fields = ["tripId", "personId", "donorId", "amount", "dateTime", "paymentInfo"];
const donorFields = [
  "firstName",
  "lastName",
  "addLine1",
  "addLine2",
  "city",
  "country",
  "state_prov",
  "postalCode",
  "phoneContryCode",
  "phoneNumber",
  "email",
  "status",
];

const loadDonation = (id) =>
  TripDonation.findByPk(id, {
    include: [
      { model: db.person, as: "participant", attributes: ["id", "firstName", "lastName"] },
      { model: db.donor, as: "donor" },
    ],
  });

const pickDonorPayload = (donor) => {
  const payload = {};
  for (const key of donorFields) {
    if (Object.prototype.hasOwnProperty.call(donor, key)) payload[key] = donor[key];
  }
  if (payload.email) payload.email = normalizeEmail(payload.email);
  return payload;
};

const upsertDonor = async (donorBody, donorId) => {
  if (donorId) {
    const existing = await Donor.findByPk(donorId);
    if (!existing) return null;
    if (donorBody) await existing.update(pickDonorPayload(donorBody));
    return existing;
  }
  if (!donorBody?.firstName?.trim()) {
    throw new Error("Donor first name is required.");
  }
  const payload = pickDonorPayload(donorBody);
  if (payload.email) {
    const existing = await Donor.findOne({
      where: db.sequelize.where(db.sequelize.fn("LOWER", db.sequelize.col("email")), payload.email),
    });
    if (existing) {
      await existing.update(payload);
      return existing;
    }
  }
  return Donor.create(payload);
};

const canManageDonations = async (req, tripId) => {
  const access = await canAccessTrip(req, tripId);
  if (!access.ok) return false;
  if (isOrgAdminForOrg(req, access.trip.orgId) || isSystemAdmin(req)) return true;
  return isTripLeaderForTrip(req, tripId);
};

const canViewDonations = async (req, tripId) => {
  const access = await canAccessTrip(req, tripId);
  if (!access.ok) return false;
  if (await canManageDonations(req, tripId)) return true;
  return isTripParticipantForTrip(req, tripId);
};

const exports = {};

exports.findAll = async (req, res) => {
  try {
    const tripId = req.query.tripId;
    if (!tripId) return res.status(400).send({ message: "tripId query param required." });
    if (!(await canViewDonations(req, tripId))) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const where = { tripId };
    const canManage = await canManageDonations(req, tripId);
    const personIdRaw = req.query.personId;
    if (canManage && personIdRaw != null && personIdRaw !== "") {
      const personId = parseInt(personIdRaw, 10);
      if (Number.isNaN(personId)) {
        return res.status(400).send({ message: "Invalid personId." });
      }
      where.personId = personId;
    } else if (isTripParticipantForTrip(req, tripId) && !isTripLeaderForTrip(req, tripId)) {
      where.personId = req.user.personId;
    }
    const data = await TripDonation.findAll({
      where,
      include: [
        { model: db.person, as: "participant", attributes: ["id", "firstName", "lastName"] },
        { model: db.donor, as: "donor" },
      ],
      order: [["dateTime", "DESC"]],
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    if (!(await canManageDonations(req, req.body.tripId))) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const { donor, donorId, ...donationBody } = req.body;
    const donorRecord = await upsertDonor(donor, donorId);
    const data = await TripDonation.create({
      ...donationBody,
      donorId: donorRecord?.id ?? null,
    });
    res.send(await loadDonation(data.id));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await TripDonation.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Donation not found." });
    if (!(await canManageDonations(req, row.tripId))) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const { donor, donorId, ...donationBody } = req.body;
    if (donor || donorId) {
      await upsertDonor(donor, donorId || row.donorId);
    }
    const result = await optimisticUpdate(TripDonation, req.params.id, donationBody, fields);
    if (!result.ok) return res.status(result.status).send({ message: result.message });
    res.send(await loadDonation(req.params.id));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const row = await TripDonation.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Donation not found." });
    if (!(await canManageDonations(req, row.tripId))) {
      return res.status(403).send({ message: "Forbidden." });
    }
    await TripDonation.destroy({ where: { id: req.params.id } });
    res.send({ message: "Deleted." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
