import db from "../models/index.js";
import path from "path";
import fs from "fs";
import {
  isOrgAdminForOrg,
  isSystemAdmin,
} from "../authorization/accessControl.js";
import { optimisticUpdate } from "../utils/optimisticUpdate.js";

const Organization = db.organization;
const orgFields = [
  "name",
  "addLine1",
  "addLine2",
  "city",
  "country",
  "state_prov",
  "postalCode",
  "phoneContryCode",
  "phoneNumber",
  "email",
  "websiteUrl",
  "facebookPage",
  "instagram",
  "colorFamily",
];

const exports = {};

exports.findAll = async (req, res) => {
  try {
    // Any authenticated user can list organizations for the org selector.
    const data = await Organization.findAll({ order: [["name", "ASC"]] });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    // Read access for branding/selection; management remains gated on update/delete.
    const data = await Organization.findByPk(req.params.id);
    if (!data) return res.status(404).send({ message: "Organization not found." });
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    if (!isSystemAdmin(req)) return res.status(403).send({ message: "Forbidden." });
    const data = await Organization.create(req.body);
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    if (!isOrgAdminForOrg(req, req.params.id) && !isSystemAdmin(req)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    const result = await optimisticUpdate(Organization, req.params.id, req.body, orgFields);
    if (!result.ok) return res.status(result.status).send({ message: result.message });
    res.send(result.data);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.uploadLogo = async (req, res) => {
  try {
    if (!isOrgAdminForOrg(req, req.params.id) && !isSystemAdmin(req)) {
      return res.status(403).send({ message: "Forbidden." });
    }
    if (!req.file) return res.status(400).send({ message: "No logo uploaded." });

    const org = await Organization.findByPk(req.params.id);
    if (!org) return res.status(404).send({ message: "Organization not found." });

    if (org.logo) {
      const previousPaths = [
        path.join("images", org.logo),
        path.join("uploads", org.logo),
      ];
      for (const filePath of previousPaths) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    const logo = path.join("logos", req.file.filename).replace(/\\/g, "/");
    await Organization.update({ logo }, { where: { id: req.params.id } });
    res.send({ message: "Logo uploaded.", logo });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    if (!isSystemAdmin(req)) return res.status(403).send({ message: "Forbidden." });
    const org = await Organization.findByPk(req.params.id);
    if (!org) return res.status(404).send({ message: "Organization not found." });
    if (org.logo) {
      const candidates = [path.join("images", org.logo), path.join("uploads", org.logo)];
      for (const filePath of candidates) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }
    await Organization.destroy({ where: { id: req.params.id } });
    res.send({ message: "Organization deleted." });
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

export default exports;
