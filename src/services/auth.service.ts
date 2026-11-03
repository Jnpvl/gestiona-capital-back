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
import {
  findCompanyByAccessEmail,
  findCompanyRecordById,
  touchCompanyLogin,
  verifyCompanyPassword,
} from "../repositories/company.repository";
import type { CompanyLoginResult, CompanyPublic } from "../types/auth.types";

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

    if (!student && (await findCompanyByAccessEmail(input.email))) {
      throw new AppError(
        403,
        "Este acceso es solo para alumnos. Si eres empresa, entra en «¿Eres empresa?».",
        "WRONG_LOGIN_COMPANY",
      );
    }

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

  async loginCompany(input: StudentLoginInput): Promise<CompanyLoginResult> {
    const company = await findCompanyByAccessEmail(input.email);

    if (!company) {
      // Solo empresas: alumnos y personal reciben un aviso claro.
      if (await findStudentByEmail(input.email)) {
        throw new AppError(
          403,
          "Este acceso es solo para empresas. Si eres alumno, entra en «Ingresar a mis cursos».",
          "WRONG_LOGIN_STUDENT",
        );
      }
      if (await findStaffByEmail(input.email)) {
        throw new AppError(
          403,
          "Este acceso es solo para empresas. El personal de Gestiona entra por el panel de administración.",
          "WRONG_LOGIN_STAFF",
        );
      }
      throw new AppError(401, "Credenciales inválidas", "INVALID_CREDENTIALS");
    }

    if (!company.access_active || !(await verifyCompanyPassword(company, input.password))) {
      throw new AppError(401, "Credenciales inválidas", "INVALID_CREDENTIALS");
    }

    await touchCompanyLogin(company.id);
    const token = tokenService.signCompanyToken({ id: company.id, email: company.access_email! });
    return { token, user: { id: company.id, name: company.name, email: company.access_email! } };
  }

  async getCompanyProfile(companyId: string): Promise<CompanyPublic> {
    const company = await findCompanyRecordById(companyId);
    if (!company || !company.access_active || !company.access_email || !company.password_hash) {
      throw new AppError(401, "Sesión inválida", "INVALID_SESSION");
    }
    return { id: company.id, name: company.name, email: company.access_email };
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
