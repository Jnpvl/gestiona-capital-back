import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { companyFormsImportService } from "../services/company-forms-import.service";
import { formService } from "../services/form.service";
import { getStaffScopeFromRequest } from "../shared/auth/staff-scope";
import {
  createFormAssignmentSchema,
  formModeSchema,
  parseEvaluationYearQuery,
} from "../validators/form.validator";

function param(req: Request, name: string): string {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
}

export class FormController {
  async downloadTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const key = param(req, "formKey");
      const buffer = await companyFormsImportService.template(param(req, "id"), key);
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").attachment(`plantilla-${key}.xlsx`).send(buffer);
    } catch (error) { next(error); }
  }
  async importExcel(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError(400, "Selecciona un archivo Excel (.xlsx)", "FILE_REQUIRED");
      const year =
        parseEvaluationYearQuery(req.body?.evaluationYear) ??
        parseEvaluationYearQuery(req.query.year);
      res.json(
        await companyFormsImportService.import(
          param(req, "id"),
          param(req, "formKey"),
          req.file.buffer,
          getStaffScopeFromRequest(req).staffId ?? null,
          req.body.dryRun !== "false",
          year,
        ),
      );
    } catch (error) { next(error); }
  }

  list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(formService.listDefinitions());
    } catch (error) {
      next(error);
    }
  }

  getByKey(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(formService.getDefinition(param(req, "key")));
    } catch (error) {
      next(error);
    }
  }

  async companyForms(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await formService.getCompanyForms(param(req, "id"), parseEvaluationYearQuery(req.query.year)));
    } catch (error) {
      next(error);
    }
  }

  async employeesFormsSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const raw = typeof req.query.studentIds === "string" ? req.query.studentIds : "";
      const uuid = /^[0-9a-f-]{36}$/i;
      const ids = raw.split(",").map((s) => s.trim()).filter((s) => uuid.test(s));
      res.json(
        await formService.employeesFormsSummary(
          param(req, "id"),
          ids,
          parseEvaluationYearQuery(req.query.year),
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  async companyResults(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await formService.companyResults(param(req, "id"), parseEvaluationYearQuery(req.query.year)));
    } catch (error) {
      next(error);
    }
  }

  async employeeFormDetail(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(
        await formService.employeeFormDetail(
          param(req, "id"),
          param(req, "studentId"),
          param(req, "formKey"),
          parseEvaluationYearQuery(req.query.year),
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  async updateEmployeeForm(req: Request, res: Response, next: NextFunction) {
    try {
      const body = (req.body ?? {}) as { answers?: unknown };
      if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
        throw new AppError(400, "Respuestas: es obligatorio enviar un objeto de respuestas", "VALIDATION_ERROR", [
          { field: "answers", label: "Respuestas", message: "es obligatorio" },
        ]);
      }
      const scope = getStaffScopeFromRequest(req);
      res.json(
        await formService.updateEmployeeForm(
          param(req, "id"),
          param(req, "studentId"),
          param(req, "formKey"),
          body.answers as Record<string, unknown>,
          scope.staffId ?? null,
          { evaluationYear: parseEvaluationYearQuery(req.query.year) },
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  async setMode(req: Request, res: Response, next: NextFunction) {
    try {
      const { mode } = formModeSchema.parse(req.body);
      res.json(
        await formService.setMode(
          param(req, "id"),
          param(req, "formKey"),
          mode,
          parseEvaluationYearQuery(req.query.year),
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  async unassign(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(
        await formService.unassign(
          param(req, "id"),
          param(req, "formKey"),
          parseEvaluationYearQuery(req.query.year),
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createFormAssignmentSchema.parse(req.body);
      const scope = getStaffScopeFromRequest(req);
      const result = await formService.assign(param(req, "id"), input, scope.staffId ?? null);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const formController = new FormController();
