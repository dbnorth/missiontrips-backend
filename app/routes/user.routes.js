import { Router } from "express";
import users from "../controllers/user.controller.js";
import authenticate, { requireSystemAdmin } from "../authorization/accessControl.js";

const router = Router();

router.get("/", [authenticate, requireSystemAdmin], users.findAll);
router.post("/", [authenticate, requireSystemAdmin], users.create);
router.put("/:id/link-person", [authenticate, requireSystemAdmin], users.linkPerson);

export default router;
