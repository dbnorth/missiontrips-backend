import { Router } from "express";
import donor from "../controllers/donor.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/lookup", [authenticate], donor.lookupByEmail);
router.get("/", [authenticate], donor.findAll);
router.post("/", [authenticate], donor.create);
router.put("/:id", [authenticate], donor.update);

export default router;
