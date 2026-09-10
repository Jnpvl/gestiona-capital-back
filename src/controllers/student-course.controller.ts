import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { studentCourseService } from "../services/student-course.service";

export class StudentCourseController {
  async listCourses(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }

      const courses = await studentCourseService.listEnrolledCourses(req.auth.sub);
      res.json({ courses });
    } catch (error) {
      next(error);
    }
  }

  async getCourseBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }

      const course = await studentCourseService.getEnrolledCourseBySlug(
        req.auth.sub,
        String(req.params.slug),
      );
      res.json({ course });
    } catch (error) {
      next(error);
    }
  }
}

export const studentCourseController = new StudentCourseController();
