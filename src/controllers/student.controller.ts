import type { NextFunction, Request, Response } from "express";
import { studentService } from "../services/student.service";
import { getStaffScopeFromRequest } from "../shared/auth/staff-scope";
import {
  assignCourseSchema,
  createStudentSchema,
  listStudentsQuerySchema,
  updateStudentSchema,
  updateStudentStatusSchema,
  sendStudentAccessSchema,
} from "../validators/student.validator";

function getParamId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function getEnrollmentId(req: Request): string {
  const enrollmentId = req.params.enrollmentId;
  return Array.isArray(enrollmentId) ? enrollmentId[0] : enrollmentId;
}

export class StudentController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const filters = listStudentsQuerySchema.parse(req.query);
      const result = await studentService.list(filters, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const result = await studentService.getById(getParamId(req), scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const input = createStudentSchema.parse(req.body);
      const result = await studentService.create(input, scope);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const input = updateStudentSchema.parse(req.body);
      const result = await studentService.update(getParamId(req), input, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const { active } = updateStudentStatusSchema.parse(req.body);
      const result = await studentService.updateStatus(getParamId(req), active, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async assignCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const { courseId, enrolledViaCompany, deliveryMode } = assignCourseSchema.parse(req.body);
      const result = await studentService.assignCourse(
        getParamId(req),
        courseId,
        enrolledViaCompany,
        deliveryMode,
        scope,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async revokeEnrollment(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const result = await studentService.revokeEnrollment(
        getParamId(req),
        getEnrollmentId(req),
        scope,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async markEnrollmentCompleted(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const result = await studentService.markEnrollmentCompleted(
        getParamId(req),
        getEnrollmentId(req),
        scope,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async sendAccess(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const { password } = sendStudentAccessSchema.parse(req.body);
      const result = await studentService.sendAccess(getParamId(req), password, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

}

export const studentController = new StudentController();
