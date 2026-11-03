import { Router } from "express";
import { formController } from "../controllers/form.controller";
import { authenticate, requireStaff } from "../middleware/auth.middleware";

const staffAuth = [authenticate, requireStaff()];

export const formAdminRoutes = Router();

formAdminRoutes.get("/", ...staffAuth, (req, res, next) => formController.list(req, res, next));
formAdminRoutes.get("/:key", ...staffAuth, (req, res, next) =>
  formController.getByKey(req, res, next),
);
