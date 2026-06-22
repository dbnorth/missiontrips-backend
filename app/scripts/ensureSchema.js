import db from "../models/index.js";
import logger from "../config/logger.js";

const ensureEmailTemplateOrgNullable = async () => {
  const [rows] = await db.sequelize.query(
    `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'emailTemplates'
       AND COLUMN_NAME = 'orgId'`
  );
  if (!rows.length || rows[0].IS_NULLABLE === "YES") return;

  const [fkRows] = await db.sequelize.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'emailTemplates'
       AND COLUMN_NAME = 'orgId'
       AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  for (const row of fkRows) {
    await db.sequelize.query(
      `ALTER TABLE emailTemplates DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``
    );
  }

  await db.sequelize.query("ALTER TABLE emailTemplates MODIFY orgId int(11) NULL");

  if (fkRows.length) {
    await db.sequelize.query(
      `ALTER TABLE emailTemplates
       ADD CONSTRAINT emailtemplates_orgId_fk
       FOREIGN KEY (orgId) REFERENCES organizations(id)
       ON DELETE CASCADE ON UPDATE CASCADE`
    );
  }

  logger.info("emailTemplates.orgId is now nullable (global master templates).");
};

export const ensureSchema = async () => {
  await ensureEmailTemplateOrgNullable();
};

export default ensureSchema;
