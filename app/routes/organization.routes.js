import { Router } from "express";
import orgs from "../controllers/organization.controller.js";
import authenticate, { requireSystemAdmin } from "../authorization/accessControl.js";
import { uploadOrgLogo } from "../config/multer.js";

const router = Router();

const handleLogoUpload = (req, res, next) => {
  uploadOrgLogo.single("logo")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).send({ message: "Logo must be 2MB or smaller." });
    }
    return res.status(400).send({ message: err.message || "Invalid logo file." });
  });
};

router.get("/", [authenticate], orgs.findAll);
router.get("/:id", [authenticate], orgs.findOne);
router.post("/", [authenticate, requireSystemAdmin], orgs.create);
router.put("/:id", [authenticate], orgs.update);
router.put("/:id/logo", [authenticate], handleLogoUpload, orgs.uploadLogo);
router.get("/:id/agreement", [authenticate], orgs.getAgreement);
router.put("/:id/agreement", [authenticate], orgs.saveAgreement);
router.delete("/:id", [authenticate, requireSystemAdmin], orgs.delete);

export default router;
