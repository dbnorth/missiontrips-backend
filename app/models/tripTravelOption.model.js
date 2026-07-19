import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const TripTravelOption = SequelizeInstance.define("tripTravelOption", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  tripId: { type: Sequelize.INTEGER, allowNull: false },
  description: { type: Sequelize.STRING(500), allowNull: false },
  priceAdjustment: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  setNumber: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
});

export default TripTravelOption;
