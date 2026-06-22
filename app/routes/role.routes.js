import { Router } from "express";
import roles from "../controllers/role.controller.js";
import authenticate from "../authorization/accessControl.js";

const router = Router();

router.get("/", [authenticate], roles.findAll);

export default router;
