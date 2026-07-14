import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const EmailLog = SequelizeInstance.define("emailLog", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  toEmail: { type: Sequelize.STRING, allowNull: false },
  fromEmail: { type: Sequelize.STRING },
  dateTime: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
  subject: { type: Sequelize.STRING(500) },
  content: { type: Sequelize.TEXT },
  emailId: { type: Sequelize.STRING(255) },
});

export default EmailLog;
