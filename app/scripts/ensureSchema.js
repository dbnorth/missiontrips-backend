import db from "../models/index.js";
import logger from "../config/logger.js";
import fs from "fs";

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

const ensureTripPeopleRoleParticipantCost = async () => {
  const [rows] = await db.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tripPeopleRoles'
       AND COLUMN_NAME = 'participantCost'`
  );
  if (rows.length) return;

  await db.sequelize.query(
    "ALTER TABLE tripPeopleRoles ADD COLUMN participantCost DECIMAL(10, 2) NULL AFTER status"
  );
  logger.info("tripPeopleRoles.participantCost column added.");
};

const ensureOrganizationWebsiteUrl = async () => {
  const [rows] = await db.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'organizations'
       AND COLUMN_NAME = 'websiteUrl'`
  );
  if (rows.length) return;

  await db.sequelize.query(
    "ALTER TABLE organizations ADD COLUMN websiteUrl VARCHAR(500) NULL AFTER email"
  );
  logger.info("organizations.websiteUrl column added.");
};

const ensureTripPeopleRoleTripWorkerRoleId = async () => {
  const [rows] = await db.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tripPeopleRoles'
       AND COLUMN_NAME = 'tripWorkerRoleId'`
  );
  if (!rows.length) {
    await db.sequelize.query(
      "ALTER TABLE tripPeopleRoles ADD COLUMN tripWorkerRoleId INT NULL AFTER roleId"
    );
    logger.info("tripPeopleRoles.tripWorkerRoleId column added.");
  }

  const [fkRows] = await db.sequelize.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tripPeopleRoles'
       AND COLUMN_NAME = 'tripWorkerRoleId'
       AND REFERENCED_TABLE_NAME IS NOT NULL`
  );
  if (!fkRows.length) {
    await db.sequelize.query(
      `ALTER TABLE tripPeopleRoles
       ADD CONSTRAINT trippeopleroles_tripWorkerRoleId_fk
       FOREIGN KEY (tripWorkerRoleId) REFERENCES tripWorkerRoles(id)
       ON DELETE SET NULL ON UPDATE CASCADE`
    );
    logger.info("tripPeopleRoles.tripWorkerRoleId foreign key added (ON DELETE SET NULL).");
  }
};

const ensurePersonProfileFields = async () => {
  const columns = [
    ["birthDate", "DATE NULL"],
    ["gender", "ENUM('male', 'female') NULL"],
    ["emergencyContactName", "VARCHAR(255) NULL"],
    ["emergencyContactPhoneCountryCode", "VARCHAR(10) NULL"],
    ["emergencyContactPhoneNumber", "VARCHAR(30) NULL"],
    ["hasAllergies", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["allergiesDescription", "TEXT NULL"],
    ["takesMedication", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["currentChurchHome", "VARCHAR(255) NULL"],
    ["currentChurchHomeCity", "VARCHAR(100) NULL"],
    ["currentChurchHomeStateProv", "VARCHAR(100) NULL"],
  ];

  for (const [columnName, definition] of columns) {
    const [rows] = await db.sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'people'
         AND COLUMN_NAME = :columnName`,
      { replacements: { columnName } }
    );
    if (rows.length) continue;

    await db.sequelize.query(
      `ALTER TABLE people ADD COLUMN \`${columnName}\` ${definition}`
    );
    logger.info(`people.${columnName} column added.`);
  }

  for (const columnName of ["passportCountry", "passportIssueDate", "passportExpireDate"]) {
    const [rows] = await db.sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'people'
         AND COLUMN_NAME = :columnName`,
      { replacements: { columnName } }
    );
    if (!rows.length) continue;
    await db.sequelize.query(`ALTER TABLE people DROP COLUMN \`${columnName}\``);
    logger.info(`people.${columnName} column removed.`);
  }
};

const ensureTripPeopleRoleApplicationFields = async () => {
  const columns = [
    ["willSelfFund", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["willRaiseFunds", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["licenseStatus", "ENUM('yes', 'yes_retired', 'no') NULL"],
    ["hasPreferredRoommate", "TINYINT(1) NOT NULL DEFAULT 0"],
    ["preferredRoommateNames", "VARCHAR(500) NULL"],
  ];

  for (const [columnName, definition] of columns) {
    const [rows] = await db.sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'tripPeopleRoles'
         AND COLUMN_NAME = :columnName`,
      { replacements: { columnName } }
    );
    if (rows.length) continue;

    await db.sequelize.query(
      `ALTER TABLE tripPeopleRoles ADD COLUMN \`${columnName}\` ${definition}`
    );
    logger.info(`tripPeopleRoles.${columnName} column added.`);
  }
};

const ensureTripApplicantRole = async () => {
  const [rows] = await db.sequelize.query(
    `SELECT id FROM roles WHERE roleName = 'Trip Applicant' LIMIT 1`
  );
  if (rows.length) return;

  await db.sequelize.query(
    `INSERT INTO roles (roleName, roleDescription, createdAt, updatedAt)
     VALUES ('Trip Applicant', 'Applied to a trip; awaiting approval', NOW(), NOW())`
  );
  logger.info("Trip Applicant role seeded.");
};

const ensureDocumentTypesTable = async () => {
  const [tables] = await db.sequelize.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'documentTypes'`
  );

  if (!tables.length) {
    await db.sequelize.query(`
      CREATE TABLE documentTypes (
        id INT NOT NULL AUTO_INCREMENT,
        description VARCHAR(255) NOT NULL,
        type ENUM('medical_licence', 'passport') NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info("documentTypes table created.");
  } else {
    const [columns] = await db.sequelize.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'documentTypes'
         AND COLUMN_NAME = 'type'`
    );
    const columnType = columns[0]?.COLUMN_TYPE || "";
    if (!columnType.includes("medical_licence") || columnType.includes("'medical'")) {
      await db.sequelize.query(`
        ALTER TABLE documentTypes
        MODIFY COLUMN type ENUM('medical', 'licences', 'passport', 'medical_licence') NOT NULL
      `);
      await db.sequelize.query(`
        UPDATE documentTypes
        SET type = 'medical_licence'
        WHERE type IN ('medical', 'licences')
      `);
      await db.sequelize.query(`
        ALTER TABLE documentTypes
        MODIFY COLUMN type ENUM('medical_licence', 'passport') NOT NULL
      `);
      logger.info("documentTypes.type enum updated to medical_licence and passport.");
    }
  }

  const [orgIdCols] = await db.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'documentTypes'
       AND COLUMN_NAME = 'orgId'`
  );
  if (orgIdCols.length) {
    const [fks] = await db.sequelize.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'documentTypes'
         AND COLUMN_NAME = 'orgId'
         AND REFERENCED_TABLE_NAME IS NOT NULL`
    );
    for (const fk of fks) {
      await db.sequelize.query(
        `ALTER TABLE documentTypes DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``
      );
    }
    await db.sequelize.query(`ALTER TABLE documentTypes DROP COLUMN orgId`);
    logger.info("documentTypes.orgId column removed (now system-wide).");
  }

  const seeds = [
    ["Medical Licence", "medical_licence"],
    ["Passport", "passport"],
  ];
  for (const [description, type] of seeds) {
    const [rows] = await db.sequelize.query(
      `SELECT id FROM documentTypes WHERE type = :type LIMIT 1`,
      { replacements: { type } }
    );
    if (rows.length) continue;
    await db.sequelize.query(
      `INSERT INTO documentTypes (description, type, createdAt, updatedAt)
       VALUES (:description, :type, NOW(), NOW())`,
      { replacements: { description, type } }
    );
    logger.info(`Document type seeded: ${description}.`);
  }
};

const ensurePersonDocumentsTable = async () => {
  fs.mkdirSync("documents/people", { recursive: true });

  const [tables] = await db.sequelize.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'personDocuments'`
  );
  if (!tables.length) {
    await db.sequelize.query(`
      CREATE TABLE personDocuments (
        id INT NOT NULL AUTO_INCREMENT,
        personId INT NOT NULL,
        documentTypeId INT NOT NULL,
        countryIssued VARCHAR(2) NULL,
        issueDate DATE NULL,
        expirationDate DATE NOT NULL,
        documentFileName VARCHAR(500) NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL,
        PRIMARY KEY (id),
        KEY personDocuments_personId_idx (personId),
        KEY personDocuments_documentTypeId_idx (documentTypeId),
        CONSTRAINT personDocuments_personId_fk
          FOREIGN KEY (personId) REFERENCES people(id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT personDocuments_documentTypeId_fk
          FOREIGN KEY (documentTypeId) REFERENCES documentTypes(id)
          ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    logger.info("personDocuments table created.");
    return;
  }

  const [cols] = await db.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'personDocuments'
       AND COLUMN_NAME = 'countryIssued'`
  );
  if (cols.length) return;

  await db.sequelize.query(
    `ALTER TABLE personDocuments ADD COLUMN countryIssued VARCHAR(2) NULL AFTER documentTypeId`
  );
  logger.info("personDocuments.countryIssued column added.");
};

const ensureWorkerRoleDocumentType = async () => {
  const [docTypeCols] = await db.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'workerRoles'
       AND COLUMN_NAME = 'documentTypeId'`
  );
  if (!docTypeCols.length) {
    await db.sequelize.query(
      `ALTER TABLE workerRoles ADD COLUMN documentTypeId INT NULL AFTER licenseRequired`
    );
    await db.sequelize.query(
      `ALTER TABLE workerRoles
       ADD CONSTRAINT workerRoles_documentTypeId_fk
       FOREIGN KEY (documentTypeId) REFERENCES documentTypes(id)
       ON DELETE SET NULL ON UPDATE CASCADE`
    );
    logger.info("workerRoles.documentTypeId column added.");
  }

  const [legacyCols] = await db.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'workerRoles'
       AND COLUMN_NAME = 'licenseType'`
  );
  if (legacyCols.length) {
    await db.sequelize.query(`ALTER TABLE workerRoles DROP COLUMN licenseType`);
    logger.info("workerRoles.licenseType column removed.");
  }
};

export const ensureSchema = async () => {
  await ensureEmailTemplateOrgNullable();
  await ensureTripPeopleRoleParticipantCost();
  await ensureOrganizationWebsiteUrl();
  await ensureTripPeopleRoleTripWorkerRoleId();
  await ensurePersonProfileFields();
  await ensureTripPeopleRoleApplicationFields();
  await ensureTripApplicantRole();
  await ensureDocumentTypesTable();
  await ensurePersonDocumentsTable();
  await ensureWorkerRoleDocumentType();
};

export default ensureSchema;
