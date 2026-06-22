import { Router } from "express";
import auth from "../controllers/auth.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.post("/login", auth.login);
router.post("/register", auth.register);
router.get("/register/organizations", auth.listOrganizationsForRegister);
router.post("/logout", auth.logout);
router.post("/change-password", [authenticate], auth.changePassword);
router.post("/reset-password", auth.resetPassword);
router.get("/me", [authenticate], auth.me);

export default router;
