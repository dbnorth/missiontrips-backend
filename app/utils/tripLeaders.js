import db from "../models/index.js";
import { ROLE_TRIP_LEADER } from "../authorization/accessControl.js";

const getTripLeaderRoleId = async () => {
  const role = await db.role.findOne({ where: { roleName: ROLE_TRIP_LEADER } });
  if (!role) throw new Error("Trip Leader role not found.");
  return role.id;
};

export const getOrgTripLeaderPeopleIds = async (orgId) => {
  const roleId = await getTripLeaderRoleId();
  const links = await db.orgPeopleRole.findAll({
    where: { orgId, roleId },
    attributes: ["peopleId"],
  });
  return new Set(links.map((l) => Number(l.peopleId)));
};

export const getTripLeaderPeopleIds = async (tripId) => {
  const roleId = await getTripLeaderRoleId();
  const rows = await db.tripPeopleRole.findAll({
    where: { tripId, roleId },
    attributes: ["peopleId"],
  });
  return rows.map((r) => Number(r.peopleId));
};

const formatPersonName = (person) => `${person.firstName || ""} ${person.lastName || ""}`.trim();

/** Map tripId -> ordered leader display names for list views. */
export const getTripLeaderNamesByTripIds = async (tripIds) => {
  const ids = [...new Set((tripIds || []).map((id) => Number(id)).filter((id) => !Number.isNaN(id)))];
  const map = new Map();
  if (!ids.length) return map;

  const roleId = await getTripLeaderRoleId();
  const rows = await db.tripPeopleRole.findAll({
    where: { tripId: ids, roleId },
    include: [{ model: db.person, as: "person", attributes: ["firstName", "lastName"] }],
    order: [["tripId", "ASC"], ["id", "ASC"]],
  });

  for (const row of rows) {
    if (!row.person) continue;
    const name = formatPersonName(row.person);
    if (!name) continue;
    const list = map.get(row.tripId) || [];
    list.push(name);
    map.set(row.tripId, list);
  }

  return map;
};

export const syncTripLeaders = async (tripId, orgId, leaderPeopleIds = []) => {
  const roleId = await getTripLeaderRoleId();
  const allowedIds = await getOrgTripLeaderPeopleIds(orgId);

  const normalized = [
    ...new Set(
      (Array.isArray(leaderPeopleIds) ? leaderPeopleIds : [])
        .map((id) => parseInt(id, 10))
        .filter((id) => !Number.isNaN(id))
    ),
  ];

  for (const peopleId of normalized) {
    if (!allowedIds.has(peopleId)) {
      throw new Error("Selected leaders must have the Trip Leader role for this organization.");
    }
  }

  const existing = await db.tripPeopleRole.findAll({ where: { tripId, roleId } });
  const existingIds = new Set(existing.map((r) => Number(r.peopleId)));
  const desiredIds = new Set(normalized);

  for (const row of existing) {
    if (!desiredIds.has(Number(row.peopleId))) {
      await row.destroy();
    }
  }

  for (const peopleId of normalized) {
    if (!existingIds.has(peopleId)) {
      await db.tripPeopleRole.create({
        tripId,
        peopleId,
        roleId,
        status: "active",
        assiginmentDateTime: new Date(),
      });
    }
  }
};
