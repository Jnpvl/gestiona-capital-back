import { Router } from "express";
import { uploadCourseAsset, uploadMiddleware, uploadStaffLogo, uploadStaffPhoto, uploadStaffSignature } from "../controllers/upload.controller";
import { authenticate, requireStaff } from "../middleware/auth.middleware";

const staffAuth = [authenticate, requireStaff()];

export const uploadRoutes = Router();

uploadRoutes.post(
  "/course/:id",
  ...staffAuth,
  uploadMiddleware,
  (req, res, next) => void uploadCourseAsset(req, res, next),
);

uploadRoutes.post(
  "/staff/:id/photo",
  ...staffAuth,
  uploadMiddleware,
  (req, res, next) => void uploadStaffPhoto(req, res, next),
);

uploadRoutes.post(
  "/staff/:id/logo",
  ...staffAuth,
  uploadMiddleware,
  (req, res, next) => void uploadStaffLogo(req, res, next),
);

uploadRoutes.post(
  "/staff/:id/signature",
  ...staffAuth,
  uploadMiddleware,
  (req, res, next) => void uploadStaffSignature(req, res, next),
);
