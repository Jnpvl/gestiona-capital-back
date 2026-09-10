import { AppError } from "../errors/app-error";
import {
  createCompany,
  findCompaniesPaginated,
  findCompanyById,
  findCompanyByNormalizedName,
  normalizeCompanyName,
  updateCompany,
} from "../repositories/company.repository";
import type {
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

    const company = await createCompany(input);
    return { company };
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
