import { Router } from "express";
import people from "../controllers/person.controller.js";
import authenticate, { requireSystemAdmin } from "../authorization/accessControl.js";
import { uploadPersonPicture } from "../config/multer.js";

const router = Router();

router.get("/", [authenticate], people.findAll);
router.get("/org-trip-leaders", [authenticate], people.findOrgTripLeaders);
router.get("/:id", [authenticate], people.findOne);
router.post("/", [authenticate], people.create);
router.put("/:id", [authenticate], people.update);
router.put("/:id/picture", [authenticate], uploadPersonPicture.single("picture"), people.uploadPicture);
router.delete("/:id", [authenticate, requireSystemAdmin], people.delete);

export default router;
