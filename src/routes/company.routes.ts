import { Router } from "express";
import { companyController } from "../controllers/company.controller";
import { authenticate, requireStaff } from "../middleware/auth.middleware";

const staffAuth = [authenticate, requireStaff()];

export const companyRoutes = Router();

companyRoutes.get("/autocomplete", ...staffAuth, (req, res, next) =>
  companyController.autocomplete(req, res, next),
);

companyRoutes.get("/", ...staffAuth, (req, res, next) =>
  companyController.list(req, res, next),
);

companyRoutes.get("/:id", ...staffAuth, (req, res, next) =>
  companyController.getById(req, res, next),
);

companyRoutes.post("/", ...staffAuth, (req, res, next) =>
  companyController.create(req, res, next),
);

companyRoutes.patch("/:id", ...staffAuth, (req, res, next) =>
  companyController.update(req, res, next),
);
