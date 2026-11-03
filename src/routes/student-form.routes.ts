import { Router } from "express";
import { studentFormController as c } from "../controllers/student-form.controller";
import { authenticate, requirePrivacyAccepted, requireStudent } from "../middleware/auth.middleware";

const studentAuth = [authenticate, requireStudent(), requirePrivacyAccepted()];

export const studentFormRoutes = Router();

studentFormRoutes.get("/", ...studentAuth, (req, res, next) => c.pending(req, res, next));
studentFormRoutes.get("/:formKey", ...studentAuth, (req, res, next) => c.get(req, res, next));
studentFormRoutes.put("/:formKey", ...studentAuth, (req, res, next) => c.save(req, res, next));
