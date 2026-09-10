import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authenticate, requireStaff, requireStudent } from "../middleware/auth.middleware";

const staffAuth = [authenticate, requireStaff()];
const studentAuth = [authenticate, requireStudent()];

export const authRoutes = Router();

authRoutes.post("/staff/login", (req, res, next) =>
  authController.staffLogin(req, res, next),
);

authRoutes.get("/staff/me", ...staffAuth, (req, res, next) =>
  authController.staffMe(req, res, next),
);

authRoutes.post("/student/login", (req, res, next) =>
  authController.studentLogin(req, res, next),
);

authRoutes.get("/student/me", ...studentAuth, (req, res, next) =>
  authController.studentMe(req, res, next),
);

authRoutes.post("/student/privacy", ...studentAuth, (req, res, next) =>
  authController.studentAcceptPrivacy(req, res, next),
);
