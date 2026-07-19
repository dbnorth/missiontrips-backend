import { Router } from "express";
import trips from "../controllers/trip.controller.js";
import tripBrowse from "../controllers/tripBrowse.controller.js";
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

router.get("/browse/orgs", [authenticate], tripBrowse.listBrowseOrgs);
router.get("/browse", [authenticate], tripBrowse.listActiveTrips);
router.get("/browse/:id", [authenticate], tripBrowse.getBrowseTrip);
router.post("/browse/:id/apply", [authenticate], tripBrowse.applyToTrip);
router.get("/browse/:id/application", [authenticate], tripBrowse.getApplication);
router.put("/browse/:id/application", [authenticate], tripBrowse.updateApplication);

router.get("/", [authenticate], trips.findAll);
router.get("/:id", [authenticate], trips.findOne);
router.post("/", [authenticate], trips.create);
router.put("/:id", [authenticate], trips.update);
router.put("/:id/image", [authenticate], handleTripImageUpload, trips.uploadImage);
router.delete("/:id", [authenticate], trips.delete);

export default router;
