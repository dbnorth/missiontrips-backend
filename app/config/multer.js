import multer from "multer";
import fs from "fs";
import path from "path";

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

const documentFilter = (_req, file, cb) => {
  const allowed = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/heic",
    "image/heif",
  ];
  const ext = path.extname(file.originalname || "").toLowerCase();
  const allowedExt = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif"];
  if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) cb(null, true);
  else cb(new Error("Only PDF, JPG, PNG, and HEIC files are allowed."), false);
};

const safeFilePart = (value) =>
  String(value || "document")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

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

export const uploadPersonDocument = multer({
  storage: makeStorage("documents/people", (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = safeFilePart(path.basename(file.originalname || "document", ext));
    cb(null, `person-${req.params.id}-${Date.now()}-${base}${ext}`);
  }),
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});
