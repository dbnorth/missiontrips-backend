import db from "../models/index.js";
import { canAccessTrip, isOrgAdminForOrg, isSystemAdmin } from "../authorization/accessControl.js";
import { toCsv, sendCsv } from "../utils/csvExport.js";

const TripPeopleRole = db.tripPeopleRole;
const TripDonation = db.tripDonation;
const Donor = db.donor;
const Person = db.person;

const exports = {};

const assertTripAccess = async (req, tripId) => {
  const access = await canAccessTrip(req, tripId);
  if (!access.ok) return { ok: false, status: 404, message: "Trip not found." };
  return { ok: true, trip: access.trip };
};

exports.participantsCsv = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const access = await assertTripAccess(req, tripId);
    if (!access.ok) return res.status(access.status).send({ message: access.message });

    const rows = await TripPeopleRole.findAll({
      where: { tripId },
      include: [
        { model: Person, as: "person" },
        { model: db.role, as: "role" },
      ],
    });
    const csvRows = rows.map((r) => ({
      firstName: r.person?.firstName,
      lastName: r.person?.lastName,
      email: r.person?.email,
      role: r.role?.roleName,
      status: r.status,
      whygoText: r.whygoText,
      assiginmentDateTime: r.assiginmentDateTime,
    }));
    const csv = toCsv(csvRows, [
      { key: "firstName", label: "First Name" },
      { key: "lastName", label: "Last Name" },
      { key: "email", label: "Email" },
      { key: "role", label: "Role" },
      { key: "status", label: "Status" },
      { key: "whygoText", label: "Why Go" },
      { key: "assiginmentDateTime", label: "Assignment Date" },
    ]);
    sendCsv(res, `trip-${tripId}-participants.csv`, csv);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.donorsCsv = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const access = await assertTripAccess(req, tripId);
    if (!access.ok) return res.status(access.status).send({ message: access.message });

    const donations = await TripDonation.findAll({
      where: { tripId },
      include: [{ model: Donor, as: "donor" }],
    });
    const donorMap = new Map();
    donations.forEach((d) => {
      if (d.donor) donorMap.set(d.donor.id, d.donor);
    });
    const csvRows = [...donorMap.values()].map((d) => ({
      firstName: d.firstName,
      lastName: d.lastName,
      email: d.email,
      city: d.city,
      state_prov: d.state_prov,
      status: d.status,
    }));
    const csv = toCsv(csvRows, [
      { key: "firstName", label: "First Name" },
      { key: "lastName", label: "Last Name" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      { key: "state_prov", label: "State/Prov" },
      { key: "status", label: "Status" },
    ]);
    sendCsv(res, `trip-${tripId}-donors.csv`, csv);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.donationsCsv = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const access = await assertTripAccess(req, tripId);
    if (!access.ok) return res.status(access.status).send({ message: access.message });

    const donations = await TripDonation.findAll({
      where: { tripId },
      include: [
        { model: Person, as: "participant", attributes: ["firstName", "lastName"] },
        { model: Donor, as: "donor" },
      ],
      order: [["dateTime", "DESC"]],
    });
    const csvRows = donations.map((d) => ({
      amount: d.amount,
      dateTime: d.dateTime,
      participant: d.participant ? `${d.participant.firstName} ${d.participant.lastName}` : "",
      donor: d.donor
        ? `${d.donor.firstName || ""} ${d.donor.lastName || ""}`.trim()
        : "",
      donorEmail: d.donor?.email || "",
    }));
    const csv = toCsv(csvRows, [
      { key: "amount", label: "Amount" },
      { key: "dateTime", label: "Date" },
      { key: "participant", label: "Participant" },
      { key: "donor", label: "Donor" },
      { key: "donorEmail", label: "Donor Email" },
    ]);
    sendCsv(res, `trip-${tripId}-donations.csv`, csv);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
