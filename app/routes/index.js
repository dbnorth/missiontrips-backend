import { Router } from "express";

import AuthRoutes from "./auth.routes.js";
import UserRoutes from "./user.routes.js";
import PersonRoutes from "./person.routes.js";
import OrganizationRoutes from "./organization.routes.js";
import TripRoutes from "./trip.routes.js";
import TripPeopleRoleRoutes from "./tripPeopleRole.routes.js";
import OrgPeopleRoleRoutes from "./orgPeopleRole.routes.js";
import TripDonationRoutes from "./tripDonation.routes.js";
import DonorRoutes from "./donor.routes.js";
import RoleRoutes from "./role.routes.js";
import DashboardRoutes from "./dashboard.routes.js";
import ExportRoutes from "./export.routes.js";
import EmailTemplateRoutes from "./emailTemplate.routes.js";
import WorkerRoleRoutes from "./workerRole.routes.js";
import TripWorkerRoleRoutes from "./tripWorkerRole.routes.js";
import TripTravelOptionRoutes from "./tripTravelOption.routes.js";
import DocumentTypeRoutes from "./documentType.routes.js";
import PublicRoutes from "./public.routes.js";

const router = Router();

router.use("/", AuthRoutes);
router.use("/users", UserRoutes);
router.use("/people", PersonRoutes);
router.use("/organizations", OrganizationRoutes);
router.use("/trips", TripRoutes);
router.use("/trip-people-roles", TripPeopleRoleRoutes);
router.use("/org-people-roles", OrgPeopleRoleRoutes);
router.use("/donations", TripDonationRoutes);
router.use("/donors", DonorRoutes);
router.use("/roles", RoleRoutes);
router.use("/dashboard", DashboardRoutes);
router.use("/export", ExportRoutes);
router.use("/email-templates", EmailTemplateRoutes);
router.use("/worker-roles", WorkerRoleRoutes);
router.use("/trip-worker-roles", TripWorkerRoleRoutes);
router.use("/trip-travel-options", TripTravelOptionRoutes);
router.use("/document-types", DocumentTypeRoutes);
router.use("/public", PublicRoutes);

export default router;
