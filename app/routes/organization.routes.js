import { Router } from "express";
import orgs from "../controllers/organization.controller.js";
import authenticate, { requireSystemAdmin } from "../authorization/accessControl.js";
import { uploadOrgLogo } from "../config/multer.js";

const router = Router();

router.get("/", [authenticate], orgs.findAll);
router.get("/:id", [authenticate], orgs.findOne);
router.post("/", [authenticate, requireSystemAdmin], orgs.create);
router.put("/:id", [authenticate], orgs.update);
router.put("/:id/logo", [authenticate], uploadOrgLogo.single("logo"), orgs.uploadLogo);
router.delete("/:id", [authenticate, requireSystemAdmin], orgs.delete);

export default router;
