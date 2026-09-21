import { Router } from "express";
import { eventController } from "../controllers/event.controller";
import { authenticate, requireStaff } from "../middleware/auth.middleware";

const staffAuth = [authenticate, requireStaff()];

export const eventAdminRoutes = Router();

eventAdminRoutes.get("/", ...staffAuth, (req, res, next) =>
  eventController.listAdmin(req, res, next),
);

eventAdminRoutes.get("/:id", ...staffAuth, (req, res, next) =>
  eventController.getAdmin(req, res, next),
);

eventAdminRoutes.post("/", ...staffAuth, (req, res, next) =>
  eventController.create(req, res, next),
);

eventAdminRoutes.patch("/:id", ...staffAuth, (req, res, next) =>
  eventController.update(req, res, next),
);

eventAdminRoutes.delete("/:id", ...staffAuth, (req, res, next) =>
  eventController.remove(req, res, next),
);
