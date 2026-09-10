import { AppError } from "../errors/app-error";
import {
  findStaffByEmail,
  findStaffById,
  toStaffPublic,
  verifyStaffPassword,
} from "../repositories/staff.repository";
import {
  acceptStudentPrivacy as persistStudentPrivacy,
  findStudentByEmail,
  findStudentRecordById,
  toStudentPublic,
  verifyStudentPassword,
} from "../repositories/student.repository";
import type {
  StaffLoginInput,
  StaffLoginResult,
  StudentLoginInput,
  StudentLoginResult,
} from "../types/auth.types";
import type { StaffPublic } from "../types/staff.types";
import type { StudentPublic } from "../types/student.types";
import { tokenService } from "./token.service";

export class AuthService {
  async loginStaff(input: StaffLoginInput): Promise<StaffLoginResult> {
    const staff = await findStaffByEmail(input.email);

    if (!staff || !staff.active) {
      throw new AppError(401, "Credenciales inválidas", "INVALID_CREDENTIALS");
    }

    const isValid = await verifyStaffPassword(staff, input.password);
    if (!isValid) {
      throw new AppError(401, "Credenciales inválidas", "INVALID_CREDENTIALS");
    }

    const token = tokenService.signStaffToken({
      id: staff.id,
      email: staff.email,
      role: staff.role,
    });

    return {
      token,
      user: toStaffPublic(staff),
    };
  }

  async getStaffProfile(staffId: string): Promise<StaffPublic> {
    const staff = await findStaffById(staffId);

    if (!staff || !staff.active) {
      throw new AppError(401, "Sesión inválida", "INVALID_SESSION");
    }

    return toStaffPublic(staff);
  }

  async loginStudent(input: StudentLoginInput): Promise<StudentLoginResult> {
    const student = await findStudentByEmail(input.email);

    if (!student || !student.active) {
      throw new AppError(401, "Credenciales inválidas", "INVALID_CREDENTIALS");
    }

    const isValid = await verifyStudentPassword(student, input.password);
    if (!isValid) {
      throw new AppError(401, "Credenciales inválidas", "INVALID_CREDENTIALS");
    }

    const token = tokenService.signStudentToken({
      id: student.id,
      email: student.email,
    });

    return {
      token,
      user: toStudentPublic(student),
    };
  }

  async getStudentProfile(studentId: string): Promise<StudentPublic> {
    const student = await findStudentRecordById(studentId);

    if (!student || !student.active) {
      throw new AppError(401, "Sesión inválida", "INVALID_SESSION");
    }

    return toStudentPublic(student);
  }

  async acceptStudentPrivacy(studentId: string): Promise<StudentPublic> {
    const student = await persistStudentPrivacy(studentId);

    if (!student || !student.active) {
      throw new AppError(401, "Sesión inválida", "INVALID_SESSION");
    }

    return toStudentPublic(student);
  }
}

export const authService = new AuthService();
