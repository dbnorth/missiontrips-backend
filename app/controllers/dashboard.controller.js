import db from "../models/index.js";
import {
  canAccessOrg,
  isOrgAdminForOrg,
  isSystemAdmin,
  isTripLeaderForTrip,
  isTripParticipantForTrip,
  ROLE_TRIP_LEADER,
  ROLE_TRIP_PARTICIPANT,
} from "../authorization/accessControl.js";

const Trip = db.trip;
const TripPeopleRole = db.tripPeopleRole;
const TripDonation = db.tripDonation;
const OrgPeopleRole = db.orgPeopleRole;
const Role = db.role;

const toUrlSlug = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[/?#]+/g, "");

const personDisplaySlug = (person) =>
  toUrlSlug(`${person?.firstName || ""} ${person?.lastName || ""}`.trim());

const orgInclude = {
  model: db.organization,
  as: "organization",
  attributes: ["id", "name", "logo", "colorFamily", "websiteUrl"],
};

const findActiveTripBySlug = async (tripSlug) => {
  const trips = await Trip.findAll({
    where: { status: "active" },
    include: [orgInclude],
  });
  return trips.find((t) => toUrlSlug(t.name) === tripSlug) || null;
};

const findActiveTripById = async (tripId) =>
  Trip.findByPk(tripId, { include: [orgInclude] });

const donorFacingRoles = async () => {
  const roles = await Role.findAll({
    where: { roleName: { [db.Sequelize.Op.in]: [ROLE_TRIP_PARTICIPANT, ROLE_TRIP_LEADER] } },
  });
  return roles.map((r) => r.id);
};

const loadTripParticipants = async (tripId, roleIds) =>
  TripPeopleRole.findAll({
    where: { tripId, roleId: { [db.Sequelize.Op.in]: roleIds }, status: "approved" },
    include: [{ model: db.person, as: "person", attributes: ["id", "firstName", "lastName", "bioText", "picture"] }],
  });

const findTripMember = async (tripId, peopleId, roleIds) =>
  TripPeopleRole.findOne({
    where: { tripId, peopleId, roleId: { [db.Sequelize.Op.in]: roleIds }, status: "approved" },
    include: [{ model: db.person, as: "person" }],
  });

const sendTripPayload = async (res, trip) => {
  const roleIds = await donorFacingRoles();
  const participants = await loadTripParticipants(trip.id, roleIds);
  res.send({ trip, participants });
};

const sendParticipantPayload = async (res, trip, link) => {
  const personId = link.peopleId || link.person?.id;
  const donationTotal = (await TripDonation.sum("amount", { where: { tripId: trip.id, personId } })) || 0;
  res.send({ trip, participant: link.person, whygoText: link.whygoText, donationTotal });
};

const exports = {};

exports.orgDashboard = async (req, res) => {
  try {
    const orgId = req.query.orgId;
    if (!orgId || !canAccessOrg(req, orgId)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    if (!isOrgAdminForOrg(req, orgId) && !isSystemAdmin(req)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const trips = await Trip.findAll({ where: { orgId } });
    const peopleCount = await OrgPeopleRole.count({ where: { orgId } });
    const tripIds = trips.map((t) => t.id);
    const donationTotal =
      tripIds.length === 0
        ? 0
        : await TripDonation.sum("amount", { where: { tripId: tripIds } });
    res.send({
      orgId: Number(orgId),
      tripCount: trips.length,
      activeTrips: trips.filter((t) => t.status === "active").length,
      peopleCount,
      donationTotal: donationTotal || 0,
      trips,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.tripDashboard = async (req, res) => {
  try {
    const tripId = req.query.tripId;
    const trip = await Trip.findByPk(tripId);
    if (!trip) return res.status(404).send({ message: "Trip not found." });

    const isLeader = isTripLeaderForTrip(req, tripId);
    const isParticipant = isTripParticipantForTrip(req, tripId);
    const isOrgAdmin = isOrgAdminForOrg(req, trip.orgId);

    if (!isLeader && !isParticipant && !isOrgAdmin && !isSystemAdmin(req)) {
      return res.status(403).send({ message: "Forbidden." });
    }

    const participants = await TripPeopleRole.count({ where: { tripId } });
    const donationTotal = (await TripDonation.sum("amount", { where: { tripId } })) || 0;
    const donationCount = await TripDonation.count({ where: { tripId } });

    res.send({
      trip,
      participants,
      donationTotal,
      donationCount,
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.participantDashboard = async (req, res) => {
  try {
    const tripId = req.query.tripId;
    if (!isTripParticipantForTrip(req, tripId)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const personId = req.user.personId;
    const donationTotal =
      (await TripDonation.sum("amount", { where: { tripId, personId } })) || 0;
    const donationCount = await TripDonation.count({ where: { tripId, personId } });
    const trip = await Trip.findByPk(tripId);
    res.send({ trip, donationTotal, donationCount, personId });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.getTripForDonor = async (req, res) => {
  try {
    const trip = await findActiveTripById(req.params.tripId);
    if (!trip || trip.status !== "active") {
      return res.status(404).send({ message: "Trip not found." });
    }
    await sendTripPayload(res, trip);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.getTripForDonorBySlug = async (req, res) => {
  try {
    const trip = await findActiveTripBySlug(req.params.tripSlug);
    if (!trip) {
      return res.status(404).send({ message: "Trip not found." });
    }
    await sendTripPayload(res, trip);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.getParticipantForDonor = async (req, res) => {
  try {
    const { tripId, personId } = req.params;
    const trip = await findActiveTripById(tripId);
    if (!trip || trip.status !== "active") {
      return res.status(404).send({ message: "Trip not found." });
    }
    const roleIds = await donorFacingRoles();
    const link = await findTripMember(trip.id, personId, roleIds);
    if (!link) return res.status(404).send({ message: "Participant not found." });
    await sendParticipantPayload(res, trip, link);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.getParticipantForDonorBySlug = async (req, res) => {
  try {
    const { tripSlug, personSlug } = req.params;
    const trip = await findActiveTripBySlug(tripSlug);
    if (!trip) {
      return res.status(404).send({ message: "Trip not found." });
    }
    const roleIds = await donorFacingRoles();
    const members = await loadTripParticipants(trip.id, roleIds);
    const link = members.find((row) => personDisplaySlug(row.person) === personSlug);
    if (!link) return res.status(404).send({ message: "Participant not found." });
    await sendParticipantPayload(res, trip, link);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.createPublicDonation = async (req, res) => {
  try {
    const { tripId, personId, donor, amount, paymentInfo } = req.body;
    const trip = await Trip.findByPk(tripId);
    if (!trip || trip.status !== "active") {
      return res.status(404).send({ message: "Trip not found." });
    }
    if (!donor?.firstName || !amount) {
      return res.status(400).send({ message: "Donor first name and amount are required." });
    }
    const donorRecord = await db.donor.create({
      ...donor,
      status: donor.status || "active",
    });
    const donation = await TripDonation.create({
      tripId,
      personId: personId || null,
      donorId: donorRecord.id,
      amount,
      dateTime: new Date(),
      paymentInfo: paymentInfo || null,
    });
    res.send({ message: "Thank you for your donation!", donation, donor: donorRecord });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
