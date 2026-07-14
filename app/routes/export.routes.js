import { Router } from "express";
import exportsCtrl from "../controllers/export.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/trips/:tripId/participants.csv", [authenticate], exportsCtrl.participantsCsv);
router.get("/trips/:tripId/donors.csv", [authenticate], exportsCtrl.donorsCsv);
router.get("/trips/:tripId/donations.csv", [authenticate], exportsCtrl.donationsCsv);

export default router;
