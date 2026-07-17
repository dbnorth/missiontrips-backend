import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const WorkerRole = SequelizeInstance.define("workerRole", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  orgId: { type: Sequelize.INTEGER, allowNull: false },
  name: { type: Sequelize.STRING(100), allowNull: false },
  description: { type: Sequelize.STRING(500) },
  licenseRequired: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  documentTypeId: { type: Sequelize.INTEGER },
  status: { type: Sequelize.ENUM("active", "inactive"), allowNull: false, defaultValue: "active" },
});

export default WorkerRole;
