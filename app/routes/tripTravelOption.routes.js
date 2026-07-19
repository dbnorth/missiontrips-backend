import { Router } from "express";
import travelOptions from "../controllers/tripTravelOption.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/", [authenticate], travelOptions.findAll);
router.post("/", [authenticate], travelOptions.create);
router.put("/:id", [authenticate], travelOptions.update);
router.delete("/:id", [authenticate], travelOptions.delete);

export default router;
