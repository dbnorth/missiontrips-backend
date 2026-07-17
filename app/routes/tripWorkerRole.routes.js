import { Router } from "express";
import twr from "../controllers/tripWorkerRole.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/", [authenticate], twr.findAll);
router.post("/", [authenticate], twr.create);
router.put("/:id", [authenticate], twr.update);
router.delete("/:id", [authenticate], twr.delete);

export default router;
