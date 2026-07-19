import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const User = SequelizeInstance.define(
  "user",
  {
    id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: Sequelize.STRING, allowNull: false, unique: "users_email_unique" },
    password: { type: Sequelize.STRING(255), allowNull: false },
    isAdmin: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    passwordSetByUser: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    defaultScope: { attributes: { exclude: ["password"] } },
    indexes: [{ name: "users_email_unique", unique: true, fields: ["email"] }],
  }
);

export default User;
