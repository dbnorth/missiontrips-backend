import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const TripPeopleRoleOption = SequelizeInstance.define("tripPeopleRoleOption", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  tripPeopleRoleId: { type: Sequelize.INTEGER, allowNull: false },
  tripTravelOptionId: { type: Sequelize.INTEGER, allowNull: false },
  selected: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
});

export default TripPeopleRoleOption;
