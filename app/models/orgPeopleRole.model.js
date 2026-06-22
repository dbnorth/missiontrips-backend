import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const OrgPeopleRole = SequelizeInstance.define("orgPeopleRole", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  orgId: { type: Sequelize.INTEGER, allowNull: false },
  peopleId: { type: Sequelize.INTEGER, allowNull: false },
  roleId: { type: Sequelize.INTEGER, allowNull: false },
  version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
});

export default OrgPeopleRole;
