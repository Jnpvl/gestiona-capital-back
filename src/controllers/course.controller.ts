import type { NextFunction, Request, Response } from "express";
import { courseService } from "../services/course.service";
import { studentCertificateService } from "../services/student-certificate.service";
import { presencialEmissionService } from "../services/presencial-emission.service";
import { buildCourseCertificatesZip } from "../services/course-certificates-export.service";
import { getStaffScopeFromRequest } from "../shared/auth/staff-scope";
import {
  createCourseSchema,
  listCoursesQuerySchema,
  updateCourseContentSchema,
  updateCoursePromotionSchema,
} from "../validators/course.validator";

function getParamId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function getEnrollmentId(req: Request): string {
  const enrollmentId = req.params.enrollmentId;
  return Array.isArray(enrollmentId) ? enrollmentId[0] : enrollmentId;
}

function getParamSlug(req: Request): string {
  const slug = req.params.slug;
  return Array.isArray(slug) ? slug[0] : slug;
}

export class CourseAdminController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const filters = listCoursesQuerySchema.parse(req.query);
      const result = await courseService.listAdmin(filters, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const result = await courseService.getAdminById(getParamId(req), scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const input = createCourseSchema.parse(req.body);
      const result = await courseService.create(input, scope);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updatePromotion(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const input = updateCoursePromotionSchema.parse(req.body);
      const result = await courseService.updatePromotion(getParamId(req), input, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateContent(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const { sections } = updateCourseContentSchema.parse(req.body);
      const result = await courseService.updateContent(getParamId(req), sections, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const result = await courseService.delete(getParamId(req), scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async previewCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const templateUrl =
        typeof req.query.templateUrl === "string" ? req.query.templateUrl : undefined;
      const { pdfBytes, filename } = await courseService.previewCertificate(
        getParamId(req),
        scope,
        templateUrl,
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      next(error);
    }
  }

  async previewDc3Certificate(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const templateUrl =
        typeof req.query.templateUrl === "string" ? req.query.templateUrl : undefined;
      const { pdfBytes, filename } = await courseService.previewDc3Certificate(
        getParamId(req),
        scope,
        templateUrl,
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      next(error);
    }
  }

  async listEnrollments(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const result = await courseService.listEnrollments(getParamId(req), scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async markEnrollmentCompleted(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      const result = await courseService.markEnrollmentCompleted(
        getParamId(req),
        getEnrollmentId(req),
        scope,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async downloadEnrollmentCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      await courseService.assertStaffCanAccessCourse(getParamId(req), scope);
      const { pdfBytes, filename } = await studentCertificateService.downloadCertificateForEnrollment(
        getParamId(req),
        getEnrollmentId(req),
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      next(error);
    }
  }

  async downloadEnrollmentDc3(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      await courseService.assertStaffCanAccessCourse(getParamId(req), scope);
      const { pdfBytes, filename } = await studentCertificateService.downloadDc3ForEnrollment(
        getParamId(req),
        getEnrollmentId(req),
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      next(error);
    }
  }

  async exportCertificatesZip(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      await courseService.assertStaffCanAccessCourse(getParamId(req), scope);
      const modeRaw = typeof req.query.deliveryMode === "string" ? req.query.deliveryMode : "all";
      const deliveryMode =
        modeRaw === "online" || modeRaw === "presencial" || modeRaw === "all"
          ? modeRaw
          : "all";
      const enrollmentIdsRaw =
        typeof req.query.enrollmentIds === "string" ? req.query.enrollmentIds : "";
      const enrollmentIds = enrollmentIdsRaw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      const { buffer, filename } = await buildCourseCertificatesZip(getParamId(req), {
        deliveryMode,
        enrollmentIds,
        kind:
          typeof req.query.kind === "string" && req.query.kind === "dc3" ? "dc3" : "constancia",
      });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async downloadPresencialTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      await courseService.assertStaffCanAccessCourse(getParamId(req), scope);
      const buffer = await presencialEmissionService.buildTemplate();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="plantilla-emision-presencial.xlsx"',
      );
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  async importPresencialExcel(req: Request, res: Response, next: NextFunction) {
    try {
      const scope = getStaffScopeFromRequest(req);
      await courseService.assertStaffCanAccessCourse(getParamId(req), scope);
      if (!req.file) {
        res.status(400).json({
          error: { message: "Sube un archivo Excel (.xlsx)", code: "FILE_REQUIRED" },
        });
        return;
      }

      const result = await presencialEmissionService.importExcel(
        getParamId(req),
        req.file.buffer,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export class CoursePublicController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await courseService.listPublic();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async featured(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await courseService.listFeatured(3);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await courseService.getPublicBySlug(getParamSlug(req));
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const courseAdminController = new CourseAdminController();
export const coursePublicController = new CoursePublicController();
