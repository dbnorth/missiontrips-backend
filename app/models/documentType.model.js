import Sequelize from "sequelize";
import SequelizeInstance from "../config/sequelizeInstance.js";

const DocumentType = SequelizeInstance.define("documentType", {
  id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
  description: { type: Sequelize.STRING(255), allowNull: false },
  type: {
    type: Sequelize.ENUM("medical_licence", "passport"),
    allowNull: false,
  },
});

export default DocumentType;
