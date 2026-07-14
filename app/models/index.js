import { Sequelize } from "sequelize";
import sequelize from "../config/sequelizeInstance.js";

import User from "./user.model.js";
import Session from "./session.model.js";
import Person from "./person.model.js";
import Role from "./role.model.js";
import Organization from "./organization.model.js";
import OrgPeopleRole from "./orgPeopleRole.model.js";
import Trip from "./trip.model.js";
import TripPeopleRole from "./tripPeopleRole.model.js";
import Donor from "./donor.model.js";
import TripDonation from "./tripDonation.model.js";
import EmailTemplate from "./emailTemplate.model.js";
import EmailLog from "./emailLog.model.js";

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = User;
db.session = Session;
db.person = Person;
db.role = Role;
db.organization = Organization;
db.orgPeopleRole = OrgPeopleRole;
db.trip = Trip;
db.tripPeopleRole = TripPeopleRole;
db.donor = Donor;
db.tripDonation = TripDonation;
db.emailTemplate = EmailTemplate;
db.emailLog = EmailLog;

db.user.hasMany(db.session, { foreignKey: "userId", onDelete: "CASCADE" });
db.session.belongsTo(db.user, { foreignKey: "userId", onDelete: "CASCADE" });

db.user.hasOne(db.person, { foreignKey: "userId", onDelete: "SET NULL" });
db.person.belongsTo(db.user, { foreignKey: "userId", onDelete: "SET NULL" });

db.organization.hasMany(db.orgPeopleRole, { foreignKey: "orgId", onDelete: "CASCADE" });
db.orgPeopleRole.belongsTo(db.organization, { foreignKey: "orgId", as: "organization", onDelete: "CASCADE" });
db.person.hasMany(db.orgPeopleRole, { foreignKey: "peopleId", onDelete: "CASCADE" });
db.orgPeopleRole.belongsTo(db.person, { foreignKey: "peopleId", as: "person", onDelete: "CASCADE" });
db.role.hasMany(db.orgPeopleRole, { foreignKey: "roleId", onDelete: "RESTRICT" });
db.orgPeopleRole.belongsTo(db.role, { foreignKey: "roleId", as: "role", onDelete: "RESTRICT" });

db.organization.hasMany(db.trip, { foreignKey: "orgId", onDelete: "CASCADE" });
db.trip.belongsTo(db.organization, { foreignKey: "orgId", as: "organization", onDelete: "CASCADE" });

db.trip.hasMany(db.tripPeopleRole, { foreignKey: "tripId", onDelete: "CASCADE" });
db.tripPeopleRole.belongsTo(db.trip, { foreignKey: "tripId", as: "trip", onDelete: "CASCADE" });
db.person.hasMany(db.tripPeopleRole, { foreignKey: "peopleId", onDelete: "CASCADE" });
db.tripPeopleRole.belongsTo(db.person, { foreignKey: "peopleId", as: "person", onDelete: "CASCADE" });
db.role.hasMany(db.tripPeopleRole, { foreignKey: "roleId", onDelete: "RESTRICT" });
db.tripPeopleRole.belongsTo(db.role, { foreignKey: "roleId", as: "role", onDelete: "RESTRICT" });

db.trip.hasMany(db.tripDonation, { foreignKey: "tripId", onDelete: "CASCADE" });
db.tripDonation.belongsTo(db.trip, { foreignKey: "tripId", as: "trip", onDelete: "CASCADE" });
db.person.hasMany(db.tripDonation, { foreignKey: "personId", onDelete: "SET NULL" });
db.tripDonation.belongsTo(db.person, { foreignKey: "personId", as: "participant", onDelete: "SET NULL" });
db.donor.hasMany(db.tripDonation, { foreignKey: "donorId", onDelete: "SET NULL" });
db.tripDonation.belongsTo(db.donor, { foreignKey: "donorId", as: "donor", onDelete: "SET NULL" });

db.organization.hasMany(db.emailTemplate, { foreignKey: "orgId", onDelete: "CASCADE" });
db.emailTemplate.belongsTo(db.organization, { foreignKey: "orgId", onDelete: "CASCADE" });
db.trip.hasMany(db.emailTemplate, { foreignKey: "tripId", onDelete: "CASCADE" });
db.emailTemplate.belongsTo(db.trip, { foreignKey: "tripId", onDelete: "CASCADE" });

export default db;
