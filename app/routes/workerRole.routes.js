import { Router } from "express";
import workerRoles from "../controllers/workerRole.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/", [authenticate], workerRoles.findAll);
router.get("/:id", [authenticate], workerRoles.findOne);
router.post("/", [authenticate], workerRoles.create);
router.put("/:id", [authenticate], workerRoles.update);
router.delete("/:id", [authenticate], workerRoles.delete);

export default router;
