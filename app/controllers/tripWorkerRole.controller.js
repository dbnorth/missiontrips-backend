import db from "../models/index.js";
import {
  canAccessTrip,
  isOrgAdminForOrg,
  isSystemAdmin,
  isTripLeaderForTrip,
} from "../authorization/accessControl.js";

const TripWorkerRole = db.tripWorkerRole;
const WorkerRole = db.workerRole;
const TripPeopleRole = db.tripPeopleRole;

const workerRoleInclude = {
  model: WorkerRole,
  as: "workerRole",
  attributes: ["id", "name", "description", "licenseRequired", "documentTypeId", "status"],
  include: [
    { model: db.documentType, as: "documentType", attributes: ["id", "description", "type"] },
  ],
};

const canManage = async (req, tripId) => {
  const access = await canAccessTrip(req, tripId);
  if (!access.ok) return { ok: false, trip: null };
  const allowed =
    isOrgAdminForOrg(req, access.trip.orgId) ||
    isSystemAdmin(req) ||
    isTripLeaderForTrip(req, tripId);
  return { ok: allowed, trip: access.trip };
};

const parseQuantity = (value) => {
  const qty = Number(value);
  if (!Number.isInteger(qty) || qty < 1) return null;
  return qty;
};

const signedUpCountsByTripWorkerRoleId = async (tripId) => {
  const rows = await TripPeopleRole.findAll({
    attributes: [
      "tripWorkerRoleId",
      [db.sequelize.fn("COUNT", db.sequelize.col("id")), "signedUpCount"],
    ],
    where: {
      tripId,
      status: { [db.Sequelize.Op.in]: ["incomplete", "ready", "approved"] },
      tripWorkerRoleId: { [db.Sequelize.Op.ne]: null },
    },
    group: ["tripWorkerRoleId"],
    raw: true,
  });
  return new Map(rows.map((r) => [Number(r.tripWorkerRoleId), Number(r.signedUpCount) || 0]));
};

const withSignedUpCount = async (tripId, rows) => {
  const counts = await signedUpCountsByTripWorkerRoleId(tripId);
  return rows.map((row) => {
    const json = typeof row.toJSON === "function" ? row.toJSON() : row;
    return {
      ...json,
      signedUpCount: counts.get(Number(json.id)) || 0,
    };
  });
};

const loadOne = async (id) => {
  const row = await TripWorkerRole.findByPk(id, { include: [workerRoleInclude] });
  if (!row) return null;
  const [enriched] = await withSignedUpCount(row.tripId, [row]);
  return enriched;
};

const exports = {};

exports.findAll = async (req, res) => {
  try {
    const tripId = req.query.tripId;
    if (!tripId) return res.status(400).send({ message: "tripId query param required." });
    const access = await canAccessTrip(req, tripId);
    if (!access.ok) return res.status(403).send({ message: "Forbidden." });

    const data = await TripWorkerRole.findAll({
      where: { tripId },
      include: [workerRoleInclude],
      order: [[{ model: WorkerRole, as: "workerRole" }, "name", "ASC"]],
    });
    res.send(await withSignedUpCount(tripId, data));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { tripId, workerRoleId } = req.body;
    if (!tripId || !workerRoleId) {
      return res.status(400).send({ message: "tripId and workerRoleId are required." });
    }
    const { ok, trip } = await canManage(req, tripId);
    if (!ok) return res.status(403).send({ message: "Forbidden." });

    const workerRole = await WorkerRole.findByPk(workerRoleId);
    if (!workerRole || Number(workerRole.orgId) !== Number(trip.orgId)) {
      return res
        .status(400)
        .send({ message: "Worker role must belong to the trip's organization." });
    }

    const quantity = parseQuantity(req.body.quantity ?? 1);
    if (quantity == null) {
      return res.status(400).send({ message: "Quantity must be a positive whole number." });
    }

    const existing = await TripWorkerRole.findOne({ where: { tripId, workerRoleId } });
    if (existing) {
      return res.status(400).send({ message: "This role is already on the trip's list." });
    }

    const data = await TripWorkerRole.create({ tripId, workerRoleId, quantity });
    res.send(await loadOne(data.id));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const row = await TripWorkerRole.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Record not found." });
    const { ok } = await canManage(req, row.tripId);
    if (!ok) return res.status(403).send({ message: "Forbidden." });

    const quantity = parseQuantity(req.body.quantity);
    if (quantity == null) {
      return res.status(400).send({ message: "Quantity must be a positive whole number." });
    }

    await row.update({ quantity });
    res.send(await loadOne(row.id));
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const row = await TripWorkerRole.findByPk(req.params.id);
    if (!row) return res.status(404).send({ message: "Record not found." });
    const { ok } = await canManage(req, row.tripId);
    if (!ok) return res.status(403).send({ message: "Forbidden." });

    // Clear participant assignments before removing the trip worker role.
    await TripPeopleRole.update(
      { tripWorkerRoleId: null },
      { where: { tripWorkerRoleId: row.id } }
    );
    await row.destroy();
    res.send({ message: "Deleted." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
