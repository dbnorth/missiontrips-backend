import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Trip = SequelizeInstance.define("trip", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  orgId: { type: Sequelize.INTEGER, allowNull: false },
  status: { type: Sequelize.ENUM("active", "completed", "inactive"), allowNull: false, defaultValue: "active" },
  name: { type: Sequelize.STRING(255), allowNull: false },
  location: { type: Sequelize.STRING(255) },
  city: { type: Sequelize.STRING(100) },
  country: { type: Sequelize.STRING(100) },
  description: { type: Sequelize.TEXT },
  startDate: { type: Sequelize.DATEONLY },
  endDate: { type: Sequelize.DATEONLY },
  image: { type: Sequelize.STRING(500) },
  facebookPage: { type: Sequelize.STRING(500) },
  instagramId: { type: Sequelize.STRING(255) },
  participantCost: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
  version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
});

export default Trip;
