import { Router } from "express";
import donations from "../controllers/tripDonation.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/", [authenticate], donations.findAll);
router.post("/", [authenticate], donations.create);
router.put("/:id", [authenticate], donations.update);
router.delete("/:id", [authenticate], donations.delete);

export default router;
