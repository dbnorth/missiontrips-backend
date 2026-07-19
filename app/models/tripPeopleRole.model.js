import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

export const TRIP_PARTICIPANT_STATUSES = [
  "incomplete",
  "ready",
  "approved",
  "denied",
  "canceled",
];

const TripPeopleRole = SequelizeInstance.define("tripPeopleRole", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  tripId: { type: Sequelize.INTEGER, allowNull: false },
  peopleId: { type: Sequelize.INTEGER, allowNull: false },
  roleId: { type: Sequelize.INTEGER, allowNull: false },
  tripWorkerRoleId: { type: Sequelize.INTEGER, allowNull: true },
  status: {
    type: Sequelize.ENUM(...TRIP_PARTICIPANT_STATUSES),
    allowNull: false,
    defaultValue: "incomplete",
  },
  participantCost: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
  whygoText: { type: Sequelize.TEXT },
  willSelfFund: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  willRaiseFunds: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  licenseStatus: {
    type: Sequelize.ENUM("yes", "yes_retired", "no"),
    allowNull: true,
  },
  hasPreferredRoommate: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  preferredRoommateNames: { type: Sequelize.STRING(500), allowNull: true },
  agreementAccepted: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  agreementSignatureName: { type: Sequelize.STRING(255), allowNull: true },
  agreementDate: { type: Sequelize.DATE, allowNull: true },
  agreementAdultFirstName: { type: Sequelize.STRING(100), allowNull: true },
  agreementAdultLastName: { type: Sequelize.STRING(100), allowNull: true },
  agreementAdultEmail: { type: Sequelize.STRING(255), allowNull: true },
  agreementAdultRelationship: { type: Sequelize.STRING(100), allowNull: true },
  assiginmentDateTime: { type: Sequelize.DATE },
  version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
});

export default TripPeopleRole;
