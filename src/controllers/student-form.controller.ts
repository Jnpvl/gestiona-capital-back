import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { formService } from "../services/form.service";
import { studentFormSaveSchema } from "../validators/form.validator";

/** Formularios que contesta el propio empleado. El alumno (y su empresa) salen del token. */
function studentIdOf(req: Request): string {
  if (!req.auth || req.auth.accountType !== "student") {
    throw new AppError(403, "Acceso denegado", "FORBIDDEN");
  }
  return req.auth.sub;
}

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}

export class StudentFormController {
  async pending(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await formService.studentPendingForms(studentIdOf(req)));
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await formService.studentForm(studentIdOf(req), param(req, "formKey")));
    } catch (error) {
      next(error);
    }
  }

  async save(req: Request, res: Response, next: NextFunction) {
    try {
      const { answers, finalize } = studentFormSaveSchema.parse(req.body);
      res.json(await formService.studentSave(studentIdOf(req), param(req, "formKey"), answers, finalize));
    } catch (error) {
      next(error);
    }
  }
}

export const studentFormController = new StudentFormController();
