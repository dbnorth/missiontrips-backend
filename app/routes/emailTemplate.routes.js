import { Router } from "express";
import templates from "../controllers/emailTemplate.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/", [authenticate], templates.findAll);
router.get("/copy-sources", [authenticate], templates.copySources);
router.get("/:id", [authenticate], templates.findOne);
router.post("/", [authenticate], templates.create);
router.put("/:id", [authenticate], templates.update);
router.delete("/:id", [authenticate], templates.delete);

export default router;
