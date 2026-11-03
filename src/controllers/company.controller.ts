import { employeeAccessService } from "../services/employee-access.service";
import type { NextFunction, Request, Response } from "express";
import { companyService } from "../services/company.service";
import { companyEmployeesImportService } from "../services/company-employees-import.service";
import { getStaffScopeFromRequest } from "../shared/auth/staff-scope";
import {
  companyAccessSchema,
  sendEmployeeAccessSchema,
  companyEmployeeImportOptionsSchema,
  createCompanySchema,
  listCompaniesQuerySchema,
  updateCompanySchema,
} from "../validators/company.validator";

function getParamId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export class CompanyController {
  async downloadEmployeesTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      await companyService.getById(getParamId(req));
      const buffer = await companyEmployeesImportService.buildTemplate();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", 'attachment; filename="plantilla-empleados.xlsx"');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async importEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({
          error: { message: "Sube un archivo Excel (.xlsx)", code: "FILE_REQUIRED" },
        });
        return;
      }
      const scope = getStaffScopeFromRequest(req);
      const { sendWelcomeEmail } = companyEmployeeImportOptionsSchema.parse(req.body ?? {});
      const result = await companyEmployeesImportService.importExcel(
        getParamId(req),
        req.file.buffer,
        { createdByStaffId: scope.staffId, sendWelcomeEmail },
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = listCompaniesQuerySchema.parse(req.query);
      const result = await companyService.list(filters);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async autocomplete(req: Request, res: Response, next: NextFunction) {
    try {
      const { search } = listCompaniesQuerySchema.parse(req.query);
      const result = await companyService.listForAutocomplete(search);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await companyService.getById(getParamId(req));
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createCompanySchema.parse(req.body);
      const result = await companyService.create(input);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const input = companyAccessSchema.parse(req.body);
      res.json(await companyService.updateAccess(getParamId(req), input));
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateCompanySchema.parse(req.body);
      const result = await companyService.update(getParamId(req), input);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export async function sendEmployeeAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const input = sendEmployeeAccessSchema.parse(req.body ?? {});
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    res.json(await employeeAccessService.send(id, input));
  } catch (error) {
    next(error);
  }
}

export const companyController = new CompanyController();
