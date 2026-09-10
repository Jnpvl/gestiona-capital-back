import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { staffAdminService } from "../services/staff-admin.service";
import { getStaffScopeFromRequest } from "../shared/auth/staff-scope";
import {
  createStaffSchema,
  listStaffQuerySchema,
  sendStaffAccessSchema,
  updateStaffSchema,
  updateStaffStatusSchema,
} from "../validators/staff.validator";

function getParamId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export class StaffAdminController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const filters = listStaffQuerySchema.parse(req.query);
      const result = await staffAdminService.list(filters, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const result = await staffAdminService.getById(getParamId(req), scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createStaffSchema.parse(req.body);
      const result = await staffAdminService.create(input);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }
      const scope = getStaffScopeFromRequest(req);
      const input = updateStaffSchema.parse(req.body);
      const result = await staffAdminService.update(getParamId(req), input, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }
      const scope = getStaffScopeFromRequest(req);
      const { active } = updateStaffStatusSchema.parse(req.body);
      const result = await staffAdminService.updateStatus(getParamId(req), active, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async sendAccess(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }
      const scope = getStaffScopeFromRequest(req);
      const { password } = sendStaffAccessSchema.parse(req.body);
      const result = await staffAdminService.sendAccess(getParamId(req), password, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const staffAdminController = new StaffAdminController();
