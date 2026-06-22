import { Router } from "express";
import trips from "../controllers/trip.controller.js";
import authenticate from "../authorization/accessControl.js";
import { uploadTripImage } from "../config/multer.js";

const router = Router();

router.get("/", [authenticate], trips.findAll);
router.get("/:id", [authenticate], trips.findOne);
router.post("/", [authenticate], trips.create);
router.put("/:id", [authenticate], trips.update);
router.put("/:id/image", [authenticate], uploadTripImage.single("image"), trips.uploadImage);
router.delete("/:id", [authenticate], trips.delete);

export default router;
