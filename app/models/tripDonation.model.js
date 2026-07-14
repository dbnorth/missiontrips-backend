import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const TripDonation = SequelizeInstance.define("tripDonation", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  tripId: { type: Sequelize.INTEGER, allowNull: false },
  personId: { type: Sequelize.INTEGER, allowNull: true },
  donorId: { type: Sequelize.INTEGER, allowNull: true },
  amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
  dateTime: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
  paymentInfo: { type: Sequelize.TEXT },
  version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
});

export default TripDonation;
