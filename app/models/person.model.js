import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Person = SequelizeInstance.define("person", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: Sequelize.INTEGER, allowNull: true },
  firstName: { type: Sequelize.STRING, allowNull: false },
  lastName: { type: Sequelize.STRING, allowNull: false },
  email: { type: Sequelize.STRING },
  addLine1: { type: Sequelize.STRING },
  addLine2: { type: Sequelize.STRING },
  city: { type: Sequelize.STRING },
  country: { type: Sequelize.STRING(2) },
  state_prov: { type: Sequelize.STRING },
  postalCode: { type: Sequelize.STRING },
  phoneContryCode: { type: Sequelize.STRING(10) },
  phoneNumber: { type: Sequelize.STRING(30) },
  picture: { type: Sequelize.STRING(500) },
  bioText: { type: Sequelize.TEXT },
  version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
});

export default Person;
