import db from "../models/index.js";
import { ROLE_TRIP_LEADER, ROLE_TRIP_PARTICIPANT } from "../authorization/accessControl.js";

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

const getTripMemberRoleIds = async () => {
  const roles = await db.role.findAll({
    where: {
      roleName: { [db.Sequelize.Op.in]: [ROLE_TRIP_LEADER, ROLE_TRIP_PARTICIPANT] },
    },
    attributes: ["id"],
  });
  return roles.map((r) => r.id);
};

const getActiveTripMemberRows = async (tripIds) => {
  const ids = [...new Set((tripIds || []).map((id) => Number(id)).filter((id) => !Number.isNaN(id)))];
  if (!ids.length) return [];

  const roleIds = await getTripMemberRoleIds();
  if (!roleIds.length) return [];

  return db.tripPeopleRole.findAll({
    where: { tripId: ids, status: "approved", roleId: roleIds },
    attributes: ["tripId", "peopleId", "participantCost"],
    raw: true,
  });
};

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

/** Map tripId -> count of active trip leaders and participants on the trip. */
export const getActiveParticipantCountsByTripIds = async (tripIds) => {
  const ids = [...new Set((tripIds || []).map((id) => Number(id)).filter((id) => !Number.isNaN(id)))];
  const map = new Map();
  if (!ids.length) return map;

  const rows = await getActiveTripMemberRows(ids);

  for (const id of ids) map.set(id, 0);
  for (const row of rows) {
    const tid = Number(row.tripId);
    map.set(tid, (map.get(tid) || 0) + 1);
  }

  return map;
};

/** Map tripId -> sum of effective costs for active trip leaders and participants. */
export const getActiveParticipantTotalCostsByTripIds = async (trips) => {
  const list = trips || [];
  const ids = list.map((t) => Number(t.id)).filter((id) => !Number.isNaN(id));
  const map = new Map();
  if (!ids.length) return map;

  const defaultCostByTripId = new Map(
    list.map((t) => [
      Number(t.id),
      t.participantCost != null && t.participantCost !== "" ? Number(t.participantCost) : null,
    ])
  );

  const rows = await getActiveTripMemberRows(ids);

  for (const id of ids) map.set(id, 0);
  for (const row of rows) {
    const tid = Number(row.tripId);
    const cost =
      row.participantCost != null && row.participantCost !== ""
        ? Number(row.participantCost)
        : defaultCostByTripId.get(tid);
    if (cost == null || Number.isNaN(cost)) continue;
    map.set(tid, (map.get(tid) || 0) + cost);
  }

  return map;
};

/** Map tripId -> donation total for active leaders/participants and general trip gifts. */
export const getDonationTotalsByTripIds = async (tripIds) => {
  const ids = [...new Set((tripIds || []).map((id) => Number(id)).filter((id) => !Number.isNaN(id)))];
  const map = new Map();
  if (!ids.length) return map;

  const memberRows = await getActiveTripMemberRows(ids);
  const memberPeopleIdsByTripId = new Map(ids.map((id) => [id, new Set()]));
  for (const row of memberRows) {
    memberPeopleIdsByTripId.get(Number(row.tripId))?.add(Number(row.peopleId));
  }

  const donations = await db.tripDonation.findAll({
    where: { tripId: ids },
    attributes: ["tripId", "personId", "amount"],
    raw: true,
  });

  for (const id of ids) map.set(id, 0);
  for (const row of donations) {
    const tid = Number(row.tripId);
    const personId = row.personId != null ? Number(row.personId) : null;
    const memberIds = memberPeopleIdsByTripId.get(tid);
    if (personId != null && !memberIds?.has(personId)) continue;
    map.set(tid, (map.get(tid) || 0) + Number(row.amount || 0));
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
        status: "approved",
        assiginmentDateTime: new Date(),
      });
    }
  }
};
