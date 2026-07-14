import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const Role = SequelizeInstance.define("role", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  roleName: { type: Sequelize.STRING(100), allowNull: false, unique: true },
  roleDescription: { type: Sequelize.STRING(500) },
});

export default Role;
