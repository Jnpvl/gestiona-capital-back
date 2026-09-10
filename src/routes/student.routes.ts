import { Router } from "express";
import { studentController } from "../controllers/student.controller";
import { authenticate, requireStaff } from "../middleware/auth.middleware";

const staffAuth = [authenticate, requireStaff()];

export const studentRoutes = Router();

studentRoutes.get("/", ...staffAuth, (req, res, next) =>
  studentController.list(req, res, next),
);

studentRoutes.get("/:id", ...staffAuth, (req, res, next) =>
  studentController.getById(req, res, next),
);

studentRoutes.post("/", ...staffAuth, (req, res, next) =>
  studentController.create(req, res, next),
);

studentRoutes.patch("/:id", ...staffAuth, (req, res, next) =>
  studentController.update(req, res, next),
);

studentRoutes.post("/:id/send-access", ...staffAuth, (req, res, next) =>
  studentController.sendAccess(req, res, next),
);

studentRoutes.patch("/:id/status", ...staffAuth, (req, res, next) =>
  studentController.updateStatus(req, res, next),
);

studentRoutes.post("/:id/enrollments", ...staffAuth, (req, res, next) =>
  studentController.assignCourse(req, res, next),
);

studentRoutes.patch("/:id/enrollments/:enrollmentId/complete", ...staffAuth, (req, res, next) =>
  studentController.markEnrollmentCompleted(req, res, next),
);

studentRoutes.delete("/:id/enrollments/:enrollmentId", ...staffAuth, (req, res, next) =>
  studentController.revokeEnrollment(req, res, next),
);
