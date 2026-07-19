import fs from "fs";
import path from "path";
import db from "../models/index.js";

const Organization = db.organization;
const AGREEMENTS_DIR = "agreements";

const pad = (n) => String(n).padStart(2, "0");

/** Filesystem-safe stamp: 2026-07-18-155230 */
export const agreementVersionStamp = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate()),
  ].join("-") +
    "-" +
    [pad(d.getHours()), pad(d.getMinutes()), pad(d.getSeconds())].join("");
};

export const agreementVersionRelativePath = (orgId, date = new Date()) =>
  path
    .join(AGREEMENTS_DIR, `org-${orgId}-participant-agreement-${agreementVersionStamp(date)}.md`)
    .replace(/\\/g, "/");

/** Legacy unversioned path (pre-versioning). */
export const agreementRelativePath = (orgId) =>
  path.join(AGREEMENTS_DIR, `org-${orgId}-participant-agreement.md`).replace(/\\/g, "/");

export const agreementAbsolutePath = (relativePath) => path.resolve(relativePath || "");

const versionFileRegex = (orgId) =>
  new RegExp(`^org-${orgId}-participant-agreement(?:-(\\d{4}-\\d{2}-\\d{2}-\\d{6}))?\\.md$`);

export const listAgreementVersions = (orgId) => {
  const dir = path.resolve(AGREEMENTS_DIR);
  if (!fs.existsSync(dir)) return [];

  const re = versionFileRegex(orgId);
  return fs
    .readdirSync(dir)
    .map((name) => {
      const match = name.match(re);
      if (!match) return null;
      const relativePath = path.join(AGREEMENTS_DIR, name).replace(/\\/g, "/");
      const stamp = match[1] || "0000-00-00-000000";
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(path.join(dir, name)).mtimeMs;
      } catch {
        /* ignore */
      }
      return { name, relativePath, stamp, mtimeMs };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.stamp !== b.stamp) return a.stamp < b.stamp ? 1 : -1;
      return b.mtimeMs - a.mtimeMs;
    });
};

export const resolveLatestAgreementPath = (orgId, preferredRelativePath = null) => {
  const versions = listAgreementVersions(orgId);
  if (versions.length) return versions[0].relativePath;

  if (preferredRelativePath) {
    const preferredAbs = agreementAbsolutePath(preferredRelativePath);
    if (fs.existsSync(preferredAbs)) return preferredRelativePath;
  }

  return null;
};

export const removeAgreementFile = (relativePath) => {
  if (!relativePath) return;
  const filePath = agreementAbsolutePath(relativePath);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore missing previous file */
    }
  }
};

export const removeAllAgreementVersions = (orgId) => {
  for (const version of listAgreementVersions(orgId)) {
    removeAgreementFile(version.relativePath);
  }
};

export const loadOrganizationAgreement = async (orgId) => {
  if (orgId == null || orgId === "") {
    return { agreementFileName: null, exists: false, content: "" };
  }
  const org = await Organization.findByPk(orgId, {
    attributes: ["id", "agreementFileName"],
  });
  if (!org) return { agreementFileName: null, exists: false, content: "" };

  const relativePath = resolveLatestAgreementPath(org.id, org.agreementFileName);
  if (!relativePath) {
    return { agreementFileName: null, exists: false, content: "" };
  }

  const filePath = agreementAbsolutePath(relativePath);
  if (!fs.existsSync(filePath)) {
    return { agreementFileName: relativePath, exists: false, content: "" };
  }

  // Keep DB pointer on the latest version when it drifted.
  if (org.agreementFileName !== relativePath) {
    try {
      await org.update({ agreementFileName: relativePath });
    } catch {
      /* non-fatal */
    }
  }

  return {
    agreementFileName: relativePath,
    exists: true,
    content: fs.readFileSync(filePath, "utf8"),
  };
};

export const AGREEMENTS_DIR_NAME = AGREEMENTS_DIR;
