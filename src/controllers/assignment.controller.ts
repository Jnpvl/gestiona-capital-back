import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { assignmentService } from "../services/assignment.service";
import { getParamId } from "../shared/utils/params";
import { getStaffScopeFromRequest } from "../shared/auth/staff-scope";
import {
  listAssignmentsQuerySchema,
  reviewAssignmentSchema,
} from "../validators/assignment.validator";

function getSlug(req: Request): string {
  const slug = req.params.slug;
  return Array.isArray(slug) ? slug[0] : slug;
}

function getBlockId(req: Request): string {
  const blockId = req.params.blockId;
  return Array.isArray(blockId) ? blockId[0] : blockId;
}

function getSubmissionId(req: Request): string {
  const submissionId = req.params.submissionId;
  return Array.isArray(submissionId) ? submissionId[0] : submissionId;
}

export class AssignmentController {
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }

      if (!req.file) {
        throw new AppError(400, "No se recibió ningún archivo", "FILE_REQUIRED");
      }

      const studentComment =
        typeof req.body.studentComment === "string" ? req.body.studentComment : null;

      const progress = await assignmentService.submit(
        req.auth.sub,
        getSlug(req),
        getBlockId(req),
        req.file,
        studentComment,
      );

      res.json({ progress });
    } catch (error) {
      next(error);
    }
  }

  async listForCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const query = listAssignmentsQuerySchema.parse(req.query);
      const result = await assignmentService.listForCourse(
        getParamId(req),
        query.status,
        scope,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async review(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }

      const scope = getStaffScopeFromRequest(req);
      const input = reviewAssignmentSchema.parse(req.body);
      const result = await assignmentService.review(
        getParamId(req),
        getSubmissionId(req),
        req.auth.sub,
        input,
        scope,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const assignmentController = new AssignmentController();
