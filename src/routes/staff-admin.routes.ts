import { Router } from "express";
import { staffAdminController } from "../controllers/staff-admin.controller";
import { authenticate, requireStaff } from "../middleware/auth.middleware";

const adminOnly = [authenticate, requireStaff("admin")];

export const staffAdminRoutes = Router();

staffAdminRoutes.get("/", ...adminOnly, (req, res, next) =>
  staffAdminController.list(req, res, next),
);

staffAdminRoutes.get("/:id", ...adminOnly, (req, res, next) =>
  staffAdminController.getById(req, res, next),
);

staffAdminRoutes.post("/", ...adminOnly, (req, res, next) =>
  staffAdminController.create(req, res, next),
);

staffAdminRoutes.patch("/:id", ...adminOnly, (req, res, next) =>
  staffAdminController.update(req, res, next),
);

staffAdminRoutes.patch("/:id/status", ...adminOnly, (req, res, next) =>
  staffAdminController.updateStatus(req, res, next),
);
