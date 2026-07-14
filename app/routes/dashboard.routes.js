import { Router } from "express";
import dashboard from "../controllers/dashboard.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/org", [authenticate], dashboard.orgDashboard);
router.get("/trip", [authenticate], dashboard.tripDashboard);
router.get("/participant", [authenticate], dashboard.participantDashboard);

export default router;
