import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Organization = SequelizeInstance.define("organization", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  name: { type: Sequelize.STRING(255), allowNull: false },
  addLine1: { type: Sequelize.STRING },
  addLine2: { type: Sequelize.STRING },
  city: { type: Sequelize.STRING },
  country: { type: Sequelize.STRING(2) },
  state_prov: { type: Sequelize.STRING },
  postalCode: { type: Sequelize.STRING },
  phoneContryCode: { type: Sequelize.STRING(10) },
  phoneNumber: { type: Sequelize.STRING(30) },
  email: { type: Sequelize.STRING },
  websiteUrl: { type: Sequelize.STRING(500) },
  facebookPage: { type: Sequelize.STRING(500) },
  instagram: { type: Sequelize.STRING(255) },
  logo: { type: Sequelize.STRING(500) },
  agreementFileName: { type: Sequelize.STRING(500) },
  colorFamily: { type: Sequelize.STRING(50) },
  version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
});

export default Organization;
