import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const TripWorkerRole = SequelizeInstance.define("tripWorkerRole", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  tripId: { type: Sequelize.INTEGER, allowNull: false },
  workerRoleId: { type: Sequelize.INTEGER, allowNull: false },
  quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
});

export default TripWorkerRole;
