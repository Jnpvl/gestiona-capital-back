import { Router } from "express";
import { subscriberController } from "../controllers/subscriber.controller";
import { authenticate, requireStaff } from "../middleware/auth.middleware";

const staffAuth = [authenticate, requireStaff()];

export const subscriberAdminRoutes = Router();

subscriberAdminRoutes.get("/", ...staffAuth, (req, res, next) =>
  subscriberController.list(req, res, next),
);

subscriberAdminRoutes.patch("/:id/status", ...staffAuth, (req, res, next) =>
  subscriberController.updateStatus(req, res, next),
);
