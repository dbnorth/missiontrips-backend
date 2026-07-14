import { Router } from "express";
import people from "../controllers/person.controller.js";
import authenticate, { requireSystemAdmin } from "../authorization/accessControl.js";
import { uploadPersonPicture } from "../config/multer.js";

const router = Router();

const handlePictureUpload = (req, res, next) => {
  uploadPersonPicture.single("picture")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).send({ message: "Image must be 2MB or smaller." });
    }
    return res.status(400).send({ message: err.message || "Invalid image file." });
  });
};

router.get("/", [authenticate], people.findAll);
router.get("/org-trip-leaders", [authenticate], people.findOrgTripLeaders);
router.get("/:id", [authenticate], people.findOne);
router.post("/", [authenticate], people.create);
router.put("/:id", [authenticate], people.update);
router.put("/:id/picture", [authenticate], handlePictureUpload, people.uploadPicture);
router.delete("/:id", [authenticate, requireSystemAdmin], people.delete);

export default router;
