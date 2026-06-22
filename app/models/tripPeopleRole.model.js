import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const TripPeopleRole = SequelizeInstance.define("tripPeopleRole", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  tripId: { type: Sequelize.INTEGER, allowNull: false },
  peopleId: { type: Sequelize.INTEGER, allowNull: false },
  roleId: { type: Sequelize.INTEGER, allowNull: false },
  status: { type: Sequelize.ENUM("active", "inactive"), allowNull: false, defaultValue: "active" },
  whygoText: { type: Sequelize.TEXT },
  assiginmentDateTime: { type: Sequelize.DATE },
  version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
});

export default TripPeopleRole;
