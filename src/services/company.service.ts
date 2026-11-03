import { AppError } from "../errors/app-error";
import {
  createCompany,
  findCompaniesPaginated,
  findCompanyById,
  findCompanyByNormalizedName,
  findCompanyByAccessEmail,
  normalizeCompanyName,
  setCompanyAccess,
  updateCompany,
} from "../repositories/company.repository";
import { findStaffByEmail } from "../repositories/staff.repository";
import { findStudentByEmail } from "../repositories/student.repository";
import { notifySafely, sendCompanyWelcomeEmail } from "./notification.service";
import type {
  CompanyAccessInput,
  CreateCompanyInput,
  ListCompaniesFilters,
  UpdateCompanyInput,
} from "../types/company.types";

export class CompanyService {
  async list(filters: ListCompaniesFilters = {}) {
    return findCompaniesPaginated(filters);
  }

  async listForAutocomplete(search?: string) {
    const { companies } = await findCompaniesPaginated({
      search,
      page: 1,
      limit: 50,
    });
    return { companies };
  }

  async getById(id: string) {
    const company = await findCompanyById(id);
    if (!company) {
      throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    }
    return { company };
  }

  async create(input: CreateCompanyInput) {
    const normalized = normalizeCompanyName(input.name);
    const existing = await findCompanyByNormalizedName(normalized);
    if (existing) {
      throw new AppError(409, "Ya existe una empresa con ese nombre", "COMPANY_EXISTS");
    }

    if (input.accessEmail) await this.assertAccessEmailFree(input.accessEmail, null);
    const { accessEmail, password, sendAccessEmail, ...profile } = input;
    let company = await createCompany(profile);
    if (accessEmail && password) {
      company = (await this.saveAccess(company.id, { accessEmail, password, sendAccessEmail })).company;
    }
    return { company };
  }

  /** El correo de acceso no puede estar en uso por otra empresa, un alumno o el personal. */
  private async assertAccessEmailFree(email: string, companyId: string | null) {
    const conflict = (message: string) =>
      new AppError(409, `Correo de acceso: ${message}`, "ACCESS_EMAIL_EXISTS", [
        { field: "accessEmail", label: "Correo de acceso", message },
      ]);
    const other = await findCompanyByAccessEmail(email);
    if (other && other.id !== companyId) throw conflict(`ya lo usa la empresa ${other.name}`);
    if (await findStudentByEmail(email)) throw conflict("ya lo usa un alumno");
    if (await findStaffByEmail(email)) throw conflict("ya lo usa un usuario del panel");
  }

  private async saveAccess(id: string, input: CompanyAccessInput) {
    await setCompanyAccess(id, { accessEmail: input.accessEmail, password: input.password ?? null });
    const company = await findCompanyById(id);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    if (input.sendAccessEmail && input.password) {
      await notifySafely(() =>
        sendCompanyWelcomeEmail({ name: company.name, email: input.accessEmail, password: input.password! }),
      );
    }
    return { company };
  }

  /** Alta o cambio del acceso de una empresa existente (correo y, opcional, contraseña nueva). */
  async updateAccess(id: string, input: CompanyAccessInput) {
    const current = await findCompanyById(id);
    if (!current) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    if (!current.hasAccess && !input.password) {
      throw new AppError(400, "Contraseña: es obligatoria para dar acceso a la empresa", "VALIDATION_ERROR", [
        { field: "password", label: "Contraseña", message: "es obligatoria para dar acceso a la empresa" },
      ]);
    }
    await this.assertAccessEmailFree(input.accessEmail, id);
    return this.saveAccess(id, input);
  }

  async update(id: string, input: UpdateCompanyInput) {
    const current = await findCompanyById(id);
    if (!current) {
      throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    }

    if (input.name && normalizeCompanyName(input.name) !== normalizeCompanyName(current.name)) {
      const existing = await findCompanyByNormalizedName(normalizeCompanyName(input.name));
      if (existing && existing.id !== id) {
        throw new AppError(409, "Ya existe una empresa con ese nombre", "COMPANY_EXISTS");
      }
    }

    const company = await updateCompany(id, input);
    if (!company) {
      throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    }

    return { company };
  }
}

export const companyService = new CompanyService();
