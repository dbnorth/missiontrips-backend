import { Router } from "express";
import documentTypes from "../controllers/documentType.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/", [authenticate], documentTypes.findAll);
router.get("/:id", [authenticate], documentTypes.findOne);
router.post("/", [authenticate], documentTypes.create);
router.put("/:id", [authenticate], documentTypes.update);
router.delete("/:id", [authenticate], documentTypes.delete);

export default router;
