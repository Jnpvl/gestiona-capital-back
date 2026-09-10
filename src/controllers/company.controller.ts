import type { NextFunction, Request, Response } from "express";
import { companyService } from "../services/company.service";
import {
  createCompanySchema,
  listCompaniesQuerySchema,
  updateCompanySchema,
} from "../validators/company.validator";

function getParamId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export class CompanyController {
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

export const companyController = new CompanyController();
