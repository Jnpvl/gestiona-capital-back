import type { StaffRole } from "../../types/staff.types";

export function isElevatedStaffRole(role: StaffRole | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdminRole(role: StaffRole | null | undefined): boolean {
  return role === "super_admin";
}

/** Roles that can be assigned from the admin panel. */
export const ASSIGNABLE_STAFF_ROLES = ["admin", "teacher"] as const;
