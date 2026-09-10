import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../errors/app-error";
import { findCourseById } from "../repositories/course.repository";
import { saveCourseAsset, saveStaffImage } from "../services/upload.service";
import { findStaffById, updateStaff } from "../repositories/staff.repository";
import { getParamId } from "../shared/utils/params";
import {
  assertCourseInstructorAccess,
  getStaffScopeFromRequest,
} from "../shared/auth/staff-scope";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const uploadMiddleware = upload.single("file");

function assertCanManageStaffMedia(req: Request, staffId: string) {
  const scope = getStaffScopeFromRequest(req);
  if (scope.isAdmin || scope.staffId === staffId) return;
  throw new AppError(403, "No tienes permisos para esta acción", "FORBIDDEN");
}

export async function uploadCourseAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = getStaffScopeFromRequest(req);
    const courseId = getParamId(req);
    const kind = String(req.body.kind ?? "");

    if (kind !== "image" && kind !== "pdf") {
      res.status(400).json({
        error: { message: "Tipo de recurso inválido. Usa image o pdf.", code: "INVALID_KIND" },
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        error: { message: "No se recibió ningún archivo", code: "FILE_REQUIRED" },
      });
      return;
    }

    const course = await findCourseById(courseId);
    if (!course) {
      res.status(404).json({
        error: { message: "Curso no encontrado", code: "COURSE_NOT_FOUND" },
      });
      return;
    }

    assertCourseInstructorAccess(course.instructor_id, scope);

    const path = await saveCourseAsset(course.slug, kind, req.file);
    res.json({ path });
  } catch (error) {
    next(error);
  }
}

export async function uploadStaffPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const staffId = getParamId(req);
    assertCanManageStaffMedia(req, staffId);

    if (!req.file) {
      res.status(400).json({
        error: { message: "No se recibió ningún archivo", code: "FILE_REQUIRED" },
      });
      return;
    }

    const staff = await findStaffById(staffId);
    if (!staff) {
      res.status(404).json({
        error: { message: "Instructor no encontrado", code: "STAFF_NOT_FOUND" },
      });
      return;
    }

    const path = await saveStaffImage(staff, req.file, "photo");
    res.json({ path });
  } catch (error) {
    next(error);
  }
}

export async function uploadStaffLogo(req: Request, res: Response, next: NextFunction) {
  try {
    const staffId = getParamId(req);
    assertCanManageStaffMedia(req, staffId);

    if (!req.file) {
      res.status(400).json({
        error: { message: "No se recibió ningún archivo", code: "FILE_REQUIRED" },
      });
      return;
    }

    const staff = await findStaffById(staffId);
    if (!staff) {
      res.status(404).json({
        error: { message: "Instructor no encontrado", code: "STAFF_NOT_FOUND" },
      });
      return;
    }

    const path = await saveStaffImage(staff, req.file, "logo");
    res.json({ path });
  } catch (error) {
    next(error);
  }
}

export async function uploadStaffSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const staffId = getParamId(req);
    assertCanManageStaffMedia(req, staffId);

    if (!req.file) {
      res.status(400).json({
        error: { message: "No se recibió ningún archivo", code: "FILE_REQUIRED" },
      });
      return;
    }

    const staff = await findStaffById(staffId);
    if (!staff) {
      res.status(404).json({
        error: { message: "Instructor no encontrado", code: "STAFF_NOT_FOUND" },
      });
      return;
    }

    const path = await saveStaffImage(staff, req.file, "signature");
    await updateStaff(staffId, { signatureUrl: path });
    res.json({ path });
  } catch (error) {
    next(error);
  }
}
