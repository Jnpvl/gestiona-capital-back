import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { studentProgressService } from "../services/student-progress.service";
import { saveCourseProgressSchema } from "../validators/progress.validator";

function getSlug(req: Request): string {
  const slug = req.params.slug;
  return Array.isArray(slug) ? slug[0] : slug;
}

export class StudentProgressController {
  async getProgress(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }

      const progress = await studentProgressService.getProgress(req.auth.sub, getSlug(req));
      res.json({ progress });
    } catch (error) {
      next(error);
    }
  }

  async saveProgress(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }

      const input = saveCourseProgressSchema.parse(req.body);
      const progress = await studentProgressService.saveProgress(
        req.auth.sub,
        getSlug(req),
        input,
      );
      res.json({ progress });
    } catch (error) {
      next(error);
    }
  }
}

export const studentProgressController = new StudentProgressController();
