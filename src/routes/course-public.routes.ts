import { Router } from "express";
import { coursePublicController } from "../controllers/course.controller";

export const coursePublicRoutes = Router();

coursePublicRoutes.get("/", (req, res, next) =>
  coursePublicController.list(req, res, next),
);

coursePublicRoutes.get("/featured", (req, res, next) =>
  coursePublicController.featured(req, res, next),
);

coursePublicRoutes.get("/:slug", (req, res, next) =>
  coursePublicController.getBySlug(req, res, next),
);
