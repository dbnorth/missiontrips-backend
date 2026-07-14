import multer from "multer";
import fs from "fs";

const imageFilter = (_req, file, cb) => {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only PNG, JPEG, GIF, and WebP images are allowed."), false);
};

const makeStorage = (dir, filenameFn) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: filenameFn,
  });

const imageExtension = (mimetype) => {
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/gif") return ".gif";
  if (mimetype === "image/webp") return ".webp";
  return ".jpg";
};

export const uploadOrgLogo = multer({
  storage: makeStorage("images/logos", (req, file, cb) => {
    cb(null, `org-${req.params.id}${imageExtension(file.mimetype)}`);
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

export const uploadPersonPicture = multer({
  storage: makeStorage("images/people", (req, file, cb) => {
    cb(null, `person-${req.params.id}${imageExtension(file.mimetype)}`);
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

export const uploadTripImage = multer({
  storage: makeStorage("images/trips", (req, file, cb) => {
    cb(null, `trip-${req.params.id}${imageExtension(file.mimetype)}`);
  }),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});
