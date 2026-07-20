import { Router } from "express";
import tpr from "../controllers/tripPeopleRole.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/", [authenticate], tpr.findAll);
router.get("/:id", [authenticate], tpr.findOne);
router.post("/", [authenticate], tpr.create);
router.put("/:id", [authenticate], tpr.update);
router.delete("/:id", [authenticate], tpr.delete);

export default router;
