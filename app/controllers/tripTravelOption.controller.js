import db from "../models/index.js";
import {
  canAccessTrip,
  isOrgAdminForOrg,
  isSystemAdmin,
  isTripLeaderForTrip,
} from "../authorization/accessControl.js";

const TripTravelOption = db.tripTravelOption;

const canManage = async (req, tripId) => {
  const access = await canAccessTrip(req, tripId);
  if (!access.ok) return { ok: false, trip: null };
  const allowed =
    isOrgAdminForOrg(req, access.trip.orgId) ||
    isSystemAdmin(req) ||
    isTripLeaderForTrip(req, tripId);
  return { ok: allowed, trip: access.trip };
};

const parsePriceAdjustment = (value) => {
  if (value == null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100) / 100;
};

const parseSetNumber = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
};

const exports = {};

exports.findAll = async (req, res) => {
  try {
    const tripId = req.query.tripId;
    if (!tripId) return res.status(400).send({ message: "tripId query param required." });
    const access = await canAccessTrip(req, tripId);
    if (!access.ok) return res.status(403).send({ message: "Forbidden." });

    const data = await TripTravelOption.findAll({
      where: { tripId },
      order: [
        ["setNumber", "ASC"],
        ["id", "ASC"],
      ],
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const tripId = req.body?.tripId;
    if (!tripId) return res.status(400).send({ message: "tripId is required." });

    const { ok } = await canManage(req, tripId);
    if (!ok) return res.status(403).send({ message: "Forbidden." });

    const description = String(req.body?.description || "").trim();
    if (!description) {
      return res.status(400).send({ message: "Description is required." });
    }

    const priceAdjustment = parsePriceAdjustment(req.body?.priceAdjustment);
    if (priceAdjustment == null) {
      return res.status(400).send({ message: "Price adjustment must be a valid dollar amount." });
    }

    const setNumber = parseSetNumber(req.body?.setNumber ?? 1);
    if (setNumber == null) {
      return res.status(400).send({ message: "Set number must be a positive whole number." });
    }

    const data = await TripTravelOption.create({
      tripId: Number(tripId),
      description,
      priceAdjustment,
      setNumber,
    });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await TripTravelOption.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Record not found." });
    const { ok } = await canManage(req, row.tripId);
    if (!ok) return res.status(403).send({ message: "Forbidden." });

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "description")) {
      const description = String(req.body.description || "").trim();
      if (!description) {
        return res.status(400).send({ message: "Description is required." });
      }
      updates.description = description;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "priceAdjustment")) {
      const priceAdjustment = parsePriceAdjustment(req.body.priceAdjustment);
      if (priceAdjustment == null) {
        return res.status(400).send({ message: "Price adjustment must be a valid dollar amount." });
      }
      updates.priceAdjustment = priceAdjustment;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "setNumber")) {
      const setNumber = parseSetNumber(req.body.setNumber);
      if (setNumber == null) {
        return res.status(400).send({ message: "Set number must be a positive whole number." });
      }
      updates.setNumber = setNumber;
    }

    await row.update(updates);
    res.send(row);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const row = await TripTravelOption.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Record not found." });
    const { ok } = await canManage(req, row.tripId);
    if (!ok) return res.status(403).send({ message: "Forbidden." });

    await row.destroy();
    res.send({ message: "Deleted." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
