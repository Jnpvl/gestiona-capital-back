import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { AppError } from "../errors/app-error";
import {
  deleteManagedUpload,
  saveCourseAsset,
  saveStaffImage,
} from "../services/upload.service";
import { findCourseById, updateCourseCoverImage } from "../repositories/course.repository";
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

function readKind(req: Request): string {
  return String(req.query.kind ?? req.body.kind ?? "").trim();
}

function readPreviousPath(req: Request): string | null {
  // Header is the most reliable channel (Multer never touches it).
  const fromHeader = String(req.headers["x-previous-upload-path"] ?? "").trim();
  if (fromHeader) return fromHeader;
  const fromQuery = String(req.query.previousPath ?? "").trim();
  if (fromQuery) return fromQuery;
  const fromBody = String(req.body?.previousPath ?? "").trim();
  return fromBody || null;
}

export async function uploadCourseAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = getStaffScopeFromRequest(req);
    const courseId = getParamId(req);
    const kind = readKind(req);
    const role = String(req.query.role ?? req.body?.role ?? "").trim();

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

    const previousPath =
      readPreviousPath(req) ?? (role === "cover" ? course.cover_image : null);
    const path = await saveCourseAsset(course.slug, kind, req.file, previousPath);

    if (role === "cover") {
      await updateCourseCoverImage(courseId, path);
    }

    res.json({ path, replaced: Boolean(previousPath) });
  } catch (error) {
    next(error);
  }
}

export async function deleteCourseUpload(req: Request, res: Response, next: NextFunction) {
  try {
    getStaffScopeFromRequest(req);
    const filePath = String(req.body?.path ?? req.query.path ?? "").trim();
    const role = String(req.body?.role ?? req.query.role ?? "").trim();
    const courseId = String(req.body?.courseId ?? req.query.courseId ?? "").trim();
    const staffId = String(req.body?.staffId ?? req.query.staffId ?? "").trim();

    if (!filePath) {
      res.status(400).json({
        error: { message: "Ruta de archivo requerida", code: "PATH_REQUIRED" },
      });
      return;
    }

    if (role === "photo" || role === "logo" || role === "signature") {
      if (!staffId) {
        res.status(400).json({
          error: { message: "staffId requerido para eliminar media de staff", code: "STAFF_ID_REQUIRED" },
        });
        return;
      }
      assertCanManageStaffMedia(req, staffId);
    }

    const deleted = await deleteManagedUpload(filePath);
    if (!deleted) {
      res.status(400).json({
        error: {
          message: "Ruta de archivo inválida. Debe estar bajo /uploads/.",
          code: "INVALID_UPLOAD_PATH",
        },
      });
      return;
    }

    if (role === "cover" && courseId) {
      await updateCourseCoverImage(courseId, null);
    }

    if (role === "photo" && staffId) {
      await updateStaff(staffId, { photoUrl: null });
    }
    if (role === "logo" && staffId) {
      await updateStaff(staffId, { logoUrl: null });
    }
    if (role === "signature" && staffId) {
      await updateStaff(staffId, { signatureUrl: null });
    }

    res.json({ ok: true, deleted: true });
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

    const previousPath = readPreviousPath(req) ?? staff.photo_url;
    const path = await saveStaffImage(staff, req.file, "photo", previousPath);
    await updateStaff(staffId, { photoUrl: path });
    res.json({ path, replaced: Boolean(previousPath) });
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

    const previousPath = readPreviousPath(req) ?? staff.logo_url;
    const path = await saveStaffImage(staff, req.file, "logo", previousPath);
    await updateStaff(staffId, { logoUrl: path });
    res.json({ path, replaced: Boolean(previousPath) });
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

    const previousPath = readPreviousPath(req) ?? staff.signature_url;
    const path = await saveStaffImage(staff, req.file, "signature", previousPath);
    await updateStaff(staffId, { signatureUrl: path });
    res.json({ path, replaced: Boolean(previousPath) });
  } catch (error) {
    next(error);
  }
}
