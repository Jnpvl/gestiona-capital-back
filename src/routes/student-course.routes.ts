import { Router } from "express";
import { studentCourseController } from "../controllers/student-course.controller";
import { studentCertificateController } from "../controllers/student-certificate.controller";
import { studentProgressController } from "../controllers/student-progress.controller";
import { assignmentController } from "../controllers/assignment.controller";
import { uploadMiddleware } from "../controllers/upload.controller";
import { authenticate, requirePrivacyAccepted, requireStudent } from "../middleware/auth.middleware";

const studentAuth = [authenticate, requireStudent(), requirePrivacyAccepted()];

export const studentCourseRoutes = Router();

studentCourseRoutes.get("/", ...studentAuth, (req, res, next) =>
  studentCourseController.listCourses(req, res, next),
);

studentCourseRoutes.get("/:slug/certificate/dc3", ...studentAuth, (req, res, next) =>
  studentCertificateController.downloadDc3Certificate(req, res, next),
);

studentCourseRoutes.get("/:slug/certificate", ...studentAuth, (req, res, next) =>
  studentCertificateController.downloadCertificate(req, res, next),
);

studentCourseRoutes.get("/:slug/progress", ...studentAuth, (req, res, next) =>
  studentProgressController.getProgress(req, res, next),
);

studentCourseRoutes.put("/:slug/progress", ...studentAuth, (req, res, next) =>
  studentProgressController.saveProgress(req, res, next),
);

studentCourseRoutes.post(
  "/:slug/assignments/:blockId/submit",
  ...studentAuth,
  uploadMiddleware,
  (req, res, next) => assignmentController.submit(req, res, next),
);

studentCourseRoutes.get("/:slug", ...studentAuth, (req, res, next) =>
  studentCourseController.getCourseBySlug(req, res, next),
);
