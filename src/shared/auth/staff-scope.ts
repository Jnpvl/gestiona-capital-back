import type { Request } from "express";
import { AppError } from "../../errors/app-error";
import type { AuthTokenPayload } from "../../types/auth.types";
import type { StaffRole } from "../../types/staff.types";
import { isElevatedStaffRole } from "./staff-roles";

export interface StaffScope {
  staffId: string;
  role: StaffRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** When set, resources must belong to this instructor. */
  instructorId: string | null;
}

export function getStaffScope(auth: AuthTokenPayload | undefined): StaffScope {
  if (!auth || auth.accountType !== "staff" || !auth.role) {
    throw new AppError(403, "Acceso denegado", "FORBIDDEN");
  }

  const isAdmin = isElevatedStaffRole(auth.role);
  return {
    staffId: auth.sub,
    role: auth.role,
    isAdmin,
    isSuperAdmin: auth.role === "super_admin",
    instructorId: isAdmin ? null : auth.sub,
  };
}

export function getStaffScopeFromRequest(req: Request): StaffScope {
  return getStaffScope(req.auth);
}

export function assertCourseInstructorAccess(
  courseInstructorId: string | null | undefined,
  scope: StaffScope,
): void {
  if (scope.isAdmin) return;
  if (!scope.instructorId || courseInstructorId !== scope.instructorId) {
    throw new AppError(403, "No tienes acceso a este curso", "COURSE_ACCESS_DENIED");
  }
}
