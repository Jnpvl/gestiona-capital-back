import { Router } from "express";
import { courseAdminController } from "../controllers/course.controller";
import { assignmentController } from "../controllers/assignment.controller";
import { uploadMiddleware } from "../controllers/upload.controller";
import { authenticate, requireStaff } from "../middleware/auth.middleware";

const staffAuth = [authenticate, requireStaff()];

export const courseAdminRoutes = Router();

courseAdminRoutes.get("/", ...staffAuth, (req, res, next) =>
  courseAdminController.list(req, res, next),
);

courseAdminRoutes.get("/:id", ...staffAuth, (req, res, next) =>
  courseAdminController.getById(req, res, next),
);

courseAdminRoutes.post("/", ...staffAuth, (req, res, next) =>
  courseAdminController.create(req, res, next),
);

courseAdminRoutes.patch("/:id/promotion", ...staffAuth, (req, res, next) =>
  courseAdminController.updatePromotion(req, res, next),
);

courseAdminRoutes.put("/:id/content", ...staffAuth, (req, res, next) =>
  courseAdminController.updateContent(req, res, next),
);

courseAdminRoutes.delete("/:id", ...staffAuth, (req, res, next) =>
  courseAdminController.delete(req, res, next),
);

courseAdminRoutes.get("/:id/assignments", ...staffAuth, (req, res, next) =>
  assignmentController.listForCourse(req, res, next),
);

courseAdminRoutes.post(
  "/:id/assignments/:submissionId/review",
  ...staffAuth,
  (req, res, next) => assignmentController.review(req, res, next),
);

courseAdminRoutes.get("/:id/enrollments", ...staffAuth, (req, res, next) =>
  courseAdminController.listEnrollments(req, res, next),
);

courseAdminRoutes.patch("/:id/enrollments/:enrollmentId/complete", ...staffAuth, (req, res, next) =>
  courseAdminController.markEnrollmentCompleted(req, res, next),
);

courseAdminRoutes.get(
  "/:id/enrollments/:enrollmentId/certificate/dc3",
  ...staffAuth,
  (req, res, next) => courseAdminController.downloadEnrollmentDc3(req, res, next),
);

courseAdminRoutes.get(
  "/:id/enrollments/:enrollmentId/certificate",
  ...staffAuth,
  (req, res, next) => courseAdminController.downloadEnrollmentCertificate(req, res, next),
);

courseAdminRoutes.get("/:id/certificates/export", ...staffAuth, (req, res, next) =>
  courseAdminController.exportCertificatesZip(req, res, next),
);

courseAdminRoutes.get("/:id/certificate/dc3/preview", ...staffAuth, (req, res, next) =>
  courseAdminController.previewDc3Certificate(req, res, next),
);

courseAdminRoutes.get("/:id/certificate/preview", ...staffAuth, (req, res, next) =>
  courseAdminController.previewCertificate(req, res, next),
);

courseAdminRoutes.get("/:id/presencial/template", ...staffAuth, (req, res, next) =>
  courseAdminController.downloadPresencialTemplate(req, res, next),
);

courseAdminRoutes.post(
  "/:id/presencial/import",
  ...staffAuth,
  uploadMiddleware,
  (req, res, next) => courseAdminController.importPresencialExcel(req, res, next),
);
