import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error";
import { findStudentRecordById } from "../repositories/student.repository";
import { tokenService } from "../services/token.service";
import type { StaffRole } from "../types/staff.types";

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice(7);
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AppError(401, "No autorizado", "UNAUTHORIZED");
    }

    req.auth = tokenService.verifyToken(token);
    next();
  } catch {
    next(new AppError(401, "Token inválido o expirado", "INVALID_TOKEN"));
  }
}

export function requireStaff(...roles: StaffRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || req.auth.accountType !== "staff") {
      next(new AppError(403, "Acceso denegado", "FORBIDDEN"));
      return;
    }

    if (roles.length > 0) {
      const role = req.auth.role;
      const allowed = new Set(roles);
      const satisfiesAdmin =
        allowed.has("admin") && (role === "admin" || role === "super_admin");
      if (!role || (!allowed.has(role) && !satisfiesAdmin)) {
        next(new AppError(403, "No tienes permisos para esta acción", "FORBIDDEN"));
        return;
      }
    }

    next();
  };
}

export function requireStudent() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || req.auth.accountType !== "student") {
      next(new AppError(403, "Acceso denegado", "FORBIDDEN"));
      return;
    }

    next();
  };
}

export function requirePrivacyAccepted() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        next(new AppError(401, "No autorizado", "UNAUTHORIZED"));
        return;
      }

      if (req.auth.accountType !== "student") {
        next();
        return;
      }

      const student = await findStudentRecordById(req.auth.sub);
      if (!student?.privacy_accepted_at) {
        next(
          new AppError(
            403,
            "Debes aceptar el aviso de privacidad para continuar",
            "PRIVACY_NOT_ACCEPTED",
          ),
        );
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
