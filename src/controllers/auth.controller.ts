import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { authService } from "../services/auth.service";
import { staffLoginSchema, studentLoginSchema } from "../validators/auth.validator";

export class AuthController {
  async staffLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const input = staffLoginSchema.parse(req.body);
      const result = await authService.loginStaff(input);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async staffMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }

      const user = await authService.getStaffProfile(req.auth.sub);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }

  async studentLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const input = studentLoginSchema.parse(req.body);
      const result = await authService.loginStudent(input);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async studentMe(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }

      const user = await authService.getStudentProfile(req.auth.sub);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }

  async studentAcceptPrivacy(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }

      const user = await authService.acceptStudentPrivacy(req.auth.sub);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
