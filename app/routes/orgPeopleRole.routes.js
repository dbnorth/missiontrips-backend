import { Router } from "express";
import opr from "../controllers/orgPeopleRole.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/", [authenticate], opr.findAll);
router.post("/", [authenticate], opr.create);
router.put("/:id", [authenticate], opr.update);
router.delete("/:id", [authenticate], opr.delete);

export default router;
