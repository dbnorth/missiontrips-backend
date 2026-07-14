import db from "../models/index.js";
import path from "path";
import fs from "fs";
import {
  canAccessTrip,
  isOrgAdminForOrg,
  isSystemAdmin,
  isTripLeaderForTrip,
  tripListFilter,
} from "../authorization/accessControl.js";
import { optimisticUpdate } from "../utils/optimisticUpdate.js";
import { getTripLeaderPeopleIds, getTripLeaderNamesByTripIds, getActiveParticipantCountsByTripIds, getActiveParticipantTotalCostsByTripIds, getDonationTotalsByTripIds, syncTripLeaders } from "../utils/tripLeaders.js";

const Trip = db.trip;
const tripFields = [
  "orgId",
  "status",
  "name",
  "location",
  "city",
  "country",
  "description",
  "startDate",
  "endDate",
  "facebookPage",
  "instagramId",
  "participantCost",
];

const exports = {};

exports.findAll = async (req, res) => {
  try {
    const where = await tripListFilter(req);
    if (where === null) return res.send([]);
    const data = await Trip.findAll({
      where: where || {},
      include: [{ model: db.organization, as: "organization", attributes: ["id", "name", "logo", "colorFamily"] }],
      order: [["startDate", "DESC"]],
    });
    const leadersByTripId = await getTripLeaderNamesByTripIds(data.map((trip) => trip.id));
    const activeParticipantsByTripId = await getActiveParticipantCountsByTripIds(data.map((trip) => trip.id));
    const totalCostsByTripId = await getActiveParticipantTotalCostsByTripIds(data);
    const donationTotalsByTripId = await getDonationTotalsByTripIds(data.map((trip) => trip.id));
    res.send(
      data.map((trip) => ({
        ...trip.toJSON(),
        leaderNames: leadersByTripId.get(trip.id) || [],
        activeParticipantCount: activeParticipantsByTripId.get(trip.id) || 0,
        totalParticipantCost: totalCostsByTripId.get(trip.id) || 0,
        donationTotal: donationTotalsByTripId.get(trip.id) || 0,
      }))
    );
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const access = await canAccessTrip(req, req.params.id);
    if (!access.ok) return res.status(404).send({ message: "Trip not found." });
    const data = await Trip.findByPk(req.params.id, {
      include: [{ model: db.organization, as: "organization" }],
    });
    const leaderPeopleIds = await getTripLeaderPeopleIds(data.id);
    const leadersByTripId = await getTripLeaderNamesByTripIds([data.id]);
    res.send({
      ...data.toJSON(),
      leaderPeopleIds,
      leaderNames: leadersByTripId.get(data.id) || [],
    });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const pickTripPayload = (body) => {
  const payload = {};
  for (const key of tripFields) {
    if (Object.prototype.hasOwnProperty.call(body, key)) payload[key] = body[key];
  }
  return payload;
};

exports.create = async (req, res) => {
  try {
    const orgId = req.body.orgId;
    if (!isOrgAdminForOrg(req, orgId) && !isSystemAdmin(req)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const { leaderPeopleIds } = req.body;
    const data = await Trip.create(pickTripPayload(req.body));
    if (Object.prototype.hasOwnProperty.call(req.body, "leaderPeopleIds")) {
      await syncTripLeaders(data.id, orgId, leaderPeopleIds);
    }
    const leaders = await getTripLeaderPeopleIds(data.id);
    res.send({ ...data.toJSON(), leaderPeopleIds: leaders });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const access = await canAccessTrip(req, req.params.id);
    if (!access.ok) return res.status(404).send({ message: "Trip not found." });
    const canManageOrgTrip =
      isOrgAdminForOrg(req, access.trip.orgId) || isSystemAdmin(req);
    if (!canManageOrgTrip && !isTripLeaderForTrip(req, req.params.id)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const body = { ...req.body };
    if (!canManageOrgTrip) {
      delete body.orgId;
    }
    const { leaderPeopleIds } = body;
    const result = await optimisticUpdate(Trip, req.params.id, body, tripFields);
    if (!result.ok) return res.status(result.status).send({ message: result.message });
    if (Object.prototype.hasOwnProperty.call(body, "leaderPeopleIds")) {
      const orgId = result.data.orgId;
      await syncTripLeaders(req.params.id, orgId, leaderPeopleIds);
    }
    const leaders = await getTripLeaderPeopleIds(req.params.id);
    res.send({ ...result.data.toJSON(), leaderPeopleIds: leaders });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.uploadImage = async (req, res) => {
  try {
    const access = await canAccessTrip(req, req.params.id);
    if (!access.ok) return res.status(404).send({ message: "Trip not found." });
    const canManage =
      isOrgAdminForOrg(req, access.trip.orgId) ||
      isSystemAdmin(req) ||
      isTripLeaderForTrip(req, req.params.id);
    if (!canManage) return res.status(403).send({ message: "Forbidden." });
    if (!req.file) return res.status(400).send({ message: "No image uploaded." });

    const trip = await Trip.findByPk(req.params.id);
    if (!trip) return res.status(404).send({ message: "Trip not found." });

    if (trip.image) {
      for (const filePath of [path.join("images", trip.image), path.join("uploads", trip.image)]) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    const image = path.join("trips", req.file.filename).replace(/\\/g, "/");
    await Trip.update({ image }, { where: { id: req.params.id } });
    res.send({ message: "Image uploaded.", image });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const access = await canAccessTrip(req, req.params.id);
    if (!access.ok) return res.status(404).send({ message: "Trip not found." });
    if (!isOrgAdminForOrg(req, access.trip.orgId) && !isSystemAdmin(req)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const trip = await Trip.findByPk(req.params.id);
    if (trip?.image) {
      for (const filePath of [path.join("images", trip.image), path.join("uploads", trip.image)]) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }
    await Trip.destroy({ where: { id: req.params.id } });
    res.send({ message: "Trip deleted." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
