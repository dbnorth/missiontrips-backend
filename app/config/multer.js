import multer from "multer";
import fs from "fs";

const imageFilter = (_req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only PNG, JPEG, and GIF images are allowed."), false);
};

const makeStorage = (dir, filenameFn) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: filenameFn,
  });

export const uploadOrgLogo = multer({
  storage: makeStorage("uploads/org-logos", (req, file, cb) => {
    const ext = file.mimetype === "image/png" ? ".png" : ".jpg";
    cb(null, `org-${req.params.id}${ext}`);
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

export const uploadPersonPicture = multer({
  storage: makeStorage("uploads/people", (req, file, cb) => {
    const ext = file.mimetype === "image/png" ? ".png" : ".jpg";
    cb(null, `person-${req.params.id}-${Date.now()}${ext}`);
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

export const uploadTripImage = multer({
  storage: makeStorage("uploads/trips", (req, file, cb) => {
    const ext = file.mimetype === "image/png" ? ".png" : ".jpg";
    cb(null, `trip-${req.params.id}-${Date.now()}${ext}`);
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});
