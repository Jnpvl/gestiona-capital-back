import { AppError } from "../errors/app-error";
import {
  createStaff,
  findStaffByEmail,
  findStaffById,
  findStaffProfileById,
  findStaffPaginated,
  setStaffActive,
  updateStaff,
} from "../repositories/staff.repository";
import { isSuperAdminRole } from "../shared/auth/staff-roles";
import type { StaffScope } from "../shared/auth/staff-scope";
import type {
  CreateStaffInput,
  ListStaffFilters,
  UpdateStaffInput,
} from "../types/staff.types";

export class StaffAdminService {
  private assertCanManageTarget(targetRole: string | undefined, scope: StaffScope) {
    if (isSuperAdminRole(targetRole as never) && !scope.isSuperAdmin) {
      throw new AppError(404, "Miembro del staff no encontrado", "STAFF_NOT_FOUND");
    }
  }

  async list(filters: ListStaffFilters = {}, scope: StaffScope) {
    return findStaffPaginated({
      ...filters,
      excludeSuperAdmin: !scope.isSuperAdmin,
    });
  }

  async getById(id: string, scope: StaffScope) {
    const staff = await findStaffProfileById(id);
    if (!staff) {
      throw new AppError(404, "Miembro del staff no encontrado", "STAFF_NOT_FOUND");
    }
    this.assertCanManageTarget(staff.role, scope);
    return { staff };
  }

  async create(input: CreateStaffInput) {
    if (isSuperAdminRole(input.role)) {
      throw new AppError(403, "No puedes crear ese tipo de cuenta", "FORBIDDEN");
    }

    const existing = await findStaffByEmail(input.email);
    if (existing) {
      throw new AppError(409, "Ya existe un usuario con ese correo", "EMAIL_EXISTS");
    }

    const staff = await createStaff(input);
    return { staff };
  }

  async update(id: string, input: UpdateStaffInput, scope: StaffScope) {
    const current = await findStaffById(id);
    if (!current) {
      throw new AppError(404, "Miembro del staff no encontrado", "STAFF_NOT_FOUND");
    }
    this.assertCanManageTarget(current.role, scope);

    if (input.role && isSuperAdminRole(input.role) && !scope.isSuperAdmin) {
      throw new AppError(403, "No puedes asignar ese rol", "FORBIDDEN");
    }

    if (isSuperAdminRole(current.role) && !scope.isSuperAdmin) {
      throw new AppError(404, "Miembro del staff no encontrado", "STAFF_NOT_FOUND");
    }

    if (input.email && input.email.toLowerCase() !== current.email) {
      const existing = await findStaffByEmail(input.email);
      if (existing) {
        throw new AppError(409, "Ya existe un usuario con ese correo", "EMAIL_EXISTS");
      }
    }

    if (id === scope.staffId && input.active === false) {
      throw new AppError(400, "No puedes desactivar tu propia cuenta", "SELF_DEACTIVATE");
    }

    if (id === scope.staffId && input.role && input.role !== current.role) {
      throw new AppError(400, "No puedes cambiar tu propio rol", "SELF_ROLE_CHANGE");
    }

    const staff = await updateStaff(id, input);
    if (!staff) {
      throw new AppError(404, "Miembro del staff no encontrado", "STAFF_NOT_FOUND");
    }

    return { staff };
  }

  async updateStatus(id: string, active: boolean, scope: StaffScope) {
    if (id === scope.staffId && !active) {
      throw new AppError(400, "No puedes desactivar tu propia cuenta", "SELF_DEACTIVATE");
    }

    const current = await findStaffById(id);
    if (!current) {
      throw new AppError(404, "Miembro del staff no encontrado", "STAFF_NOT_FOUND");
    }
    this.assertCanManageTarget(current.role, scope);

    const staff = await setStaffActive(id, active);
    if (!staff) {
      throw new AppError(404, "Miembro del staff no encontrado", "STAFF_NOT_FOUND");
    }

    return { staff };
  }
}

export const staffAdminService = new StaffAdminService();
