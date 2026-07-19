import db from "../models/index.js";
import logger from "../config/logger.js";

const Session = db.session;
const User = db.user;
const Person = db.person;
const OrgPeopleRole = db.orgPeopleRole;
const TripPeopleRole = db.tripPeopleRole;
const Role = db.role;
const Trip = db.trip;

export const ROLE_ORG_ADMIN = "Org Admin";
export const ROLE_TRIP_LEADER = "Trip Leader";
export const ROLE_TRIP_PARTICIPANT = "Trip Participant";
export const ROLE_PENDING_USER = "Pending User";
export const ROLE_TRIP_APPLICANT = "Trip Applicant";

export const isActiveOrgRole = (roleName) => roleName === ROLE_ORG_ADMIN;

export const parseOrganizationScopeHeader = (req) => {
  const h = req.get("x-acting-organization-id");
  if (h == null || h === "") return null;
  const id = parseInt(h, 10);
  return Number.isNaN(id) ? null : id;
};

export const parseActingOrganizationHeader = (req) => {
  if (!req.user?.isAdmin) return null;
  return parseOrganizationScopeHeader(req);
};

/** Org IDs from trips the user leads (active Trip Leader assignments). */
export const getTripLeaderOrgIds = (req) => [
  ...new Set(
    (req.user?.tripRoles || [])
      .filter((r) => r.role?.roleName === ROLE_TRIP_LEADER && r.status === "approved")
      .map((r) => Number(r.trip?.orgId))
      .filter((id) => !Number.isNaN(id))
  ),
];

/** Org IDs used to scope people lists (user org or admin-selected org). Returns "all" for system admin with no org scope. */
export const peopleListOrgIds = (req) => {
  if (isSystemAdmin(req)) {
    const orgId = parseOrganizationScopeHeader(req);
    if (orgId == null) return "all";
    return [orgId];
  }
  const adminOrgIds = [
    ...new Set(
      (req.user?.orgRoles || [])
        .filter((r) => r.role?.roleName === ROLE_ORG_ADMIN)
        .map((r) => Number(r.orgId))
    ),
  ];
  const candidateOrgIds = adminOrgIds.length ? adminOrgIds : getTripLeaderOrgIds(req);
  if (!candidateOrgIds.length) return null;
  const scoped = parseOrganizationScopeHeader(req);
  if (scoped != null && candidateOrgIds.includes(scoped)) return [scoped];
  if (candidateOrgIds.length === 1) return candidateOrgIds;
  return null;
};

export const isSystemAdmin = (req) => !!req.user?.isAdmin;

const loadUserContext = async (userId) => {
  const person = await Person.findOne({ where: { userId } });
  const personId = person?.id ?? null;

  let orgRoles = [];
  let tripRoles = [];

  if (personId) {
    orgRoles = await OrgPeopleRole.findAll({
      where: { peopleId: personId },
      include: [
        { model: db.organization, as: "organization", attributes: ["id", "name", "logo", "colorFamily"] },
        { model: Role, as: "role", attributes: ["id", "roleName"] },
      ],
    });

    tripRoles = await TripPeopleRole.findAll({
      where: { peopleId: personId, status: "approved" },
      include: [
        {
          model: Trip,
          as: "trip",
          attributes: ["id", "name", "orgId", "status"],
        },
        { model: Role, as: "role", attributes: ["id", "roleName"] },
      ],
    });
  }

  return { person, personId, orgRoles, tripRoles };
};

export const authenticate = (req, res, next) => {
  const authHeader = req.get("authorization");
  if (authHeader == null || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized! No Auth Header" });
  }
  const token = authHeader.slice(7);
  Session.findOne({
    where: { token },
    include: [{ model: User, attributes: ["id", "email", "isAdmin"] }],
  })
    .then(async (session) => {
      if (session == null || session.expirationDate < Date.now()) {
        return res.status(401).send({ message: "Unauthorized! Invalid or expired token." });
      }
      const u = session.user;
      if (!u) {
        return res.status(401).send({ message: "Unauthorized! User not found." });
      }
      const ctx = await loadUserContext(u.id);
      req.user = {
        id: u.id,
        email: u.email,
        isAdmin: u.isAdmin,
        personId: ctx.personId,
        person: ctx.person,
        orgRoles: ctx.orgRoles,
        tripRoles: ctx.tripRoles,
      };
      next();
    })
    .catch((err) => {
      logger.error(`Authentication error: ${err.message}`);
      return res.status(500).send({ message: "Error during authentication" });
    });
};

export const requireSystemAdmin = (req, res, next) => {
  if (!isSystemAdmin(req)) {
    return res.status(403).send({ message: "Forbidden. System admin required." });
  }
  next();
};

export const getOrgRolesForOrg = (req, orgId) => {
  const id = Number(orgId);
  return (req.user?.orgRoles || []).filter((r) => Number(r.orgId) === id);
};

export const getOrgRoleForOrg = (req, orgId) => getOrgRolesForOrg(req, orgId)[0];

export const isOrgAdminForOrg = (req, orgId) => {
  if (isSystemAdmin(req)) {
    const acting = parseActingOrganizationHeader(req);
    if (acting == null) return true;
    return Number(acting) === Number(orgId);
  }
  const roles = getOrgRolesForOrg(req, orgId);
  return roles.some((r) => r.role?.roleName === ROLE_ORG_ADMIN);
};

export const canAccessOrg = (req, orgId) => {
  if (isSystemAdmin(req)) {
    const acting = parseActingOrganizationHeader(req);
    if (acting == null) return true;
    return Number(acting) === Number(orgId);
  }
  const roles = getOrgRolesForOrg(req, orgId);
  if (roles.some((r) => isActiveOrgRole(r.role?.roleName))) return true;
  const leaderOrgIds = [
    ...new Set(
      (req.user?.tripRoles || [])
        .filter((r) => r.role?.roleName === ROLE_TRIP_LEADER)
        .map((r) => Number(r.trip?.orgId))
        .filter((id) => !Number.isNaN(id))
    ),
  ];
  return leaderOrgIds.includes(Number(orgId));
};

export const getTripRoleForTrip = (req, tripId) => {
  const id = Number(tripId);
  return (req.user?.tripRoles || []).find((r) => Number(r.tripId) === id && r.status === "approved");
};

export const isTripLeaderForTrip = (req, tripId) => {
  const role = getTripRoleForTrip(req, tripId);
  return role?.role?.roleName === ROLE_TRIP_LEADER;
};

export const isTripParticipantForTrip = (req, tripId) => {
  const role = getTripRoleForTrip(req, tripId);
  return role?.role?.roleName === ROLE_TRIP_PARTICIPANT;
};

export const canAccessTrip = async (req, tripId) => {
  const trip = await Trip.findByPk(tripId, { attributes: ["id", "orgId"] });
  if (!trip) return { ok: false, trip: null };
  // System admins can manage any trip; acting-org only scopes list views.
  if (isSystemAdmin(req)) return { ok: true, trip };
  if (isOrgAdminForOrg(req, trip.orgId)) return { ok: true, trip };
  if (isTripLeaderForTrip(req, tripId)) return { ok: true, trip };
  if (isTripParticipantForTrip(req, tripId)) return { ok: true, trip };
  return { ok: false, trip };
};

export const orgListFilter = (req) => {
  if (isSystemAdmin(req)) {
    const acting = parseActingOrganizationHeader(req);
    if (acting != null) return { id: acting };
    return {};
  }
  const orgIds = [
    ...new Set(
      (req.user?.orgRoles || [])
        .filter((r) => isActiveOrgRole(r.role?.roleName))
        .map((r) => r.orgId)
    ),
  ];
  if (!orgIds.length) return null;
  return { id: orgIds };
};

export const tripListFilter = async (req) => {
  if (isSystemAdmin(req)) {
    const acting = parseActingOrganizationHeader(req);
    if (acting != null) return { orgId: acting };
    return {};
  }
  const adminOrgIds = (req.user?.orgRoles || [])
    .filter((r) => r.role?.roleName === ROLE_ORG_ADMIN)
    .map((r) => r.orgId);
  if (adminOrgIds.length) {
    return { orgId: adminOrgIds };
  }
  const tripIds = (req.user?.tripRoles || []).map((r) => r.tripId);
  if (!tripIds.length) return null;
  return { id: tripIds };
};

export default authenticate;
