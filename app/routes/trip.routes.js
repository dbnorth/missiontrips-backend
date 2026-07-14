import { Router } from "express";
import trips from "../controllers/trip.controller.js";
import authenticate from "../authorization/accessControl.js";
import { uploadTripImage } from "../config/multer.js";

const router = Router();

const handleTripImageUpload = (req, res, next) => {
  uploadTripImage.single("image")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).send({ message: "Image must be 2MB or smaller." });
    }
    return res.status(400).send({ message: err.message || "Invalid image file." });
  });
};

router.get("/", [authenticate], trips.findAll);
router.get("/:id", [authenticate], trips.findOne);
router.post("/", [authenticate], trips.create);
router.put("/:id", [authenticate], trips.update);
router.put("/:id/image", [authenticate], handleTripImageUpload, trips.uploadImage);
router.delete("/:id", [authenticate], trips.delete);

export default router;
