import { Router } from "express";
import dashboard from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/trips/:tripId", dashboard.getTripForDonor);
router.get("/trips/:tripId/participants/:personId", dashboard.getParticipantForDonor);
router.post("/donations", dashboard.createPublicDonation);

export default router;
