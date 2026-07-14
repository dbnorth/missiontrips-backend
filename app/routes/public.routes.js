import { Router } from "express";
import dashboard from "../controllers/dashboard.controller.js";

const router = Router();

router.get("/trips/by-name/:tripSlug/participants/:personSlug", dashboard.getParticipantForDonorBySlug);
router.get("/trips/by-name/:tripSlug", dashboard.getTripForDonorBySlug);
router.get("/trips/:tripId/participants/:personId", dashboard.getParticipantForDonor);
router.get("/trips/:tripId", dashboard.getTripForDonor);
router.post("/donations", dashboard.createPublicDonation);

export default router;
