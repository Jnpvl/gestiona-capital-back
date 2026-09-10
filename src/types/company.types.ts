export interface CompanyRecord {
  id: string;
  name: string;
  name_normalized: string;
  rfc: string | null;
  employer_representative: string | null;
  workers_representative: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CompanyListItem {
  id: string;
  name: string;
  rfc: string | null;
  employerRepresentative: string | null;
  studentsCount: number;
  createdAt: string;
}

export interface CompanyDetail {
  id: string;
  name: string;
  rfc: string | null;
  employerRepresentative: string | null;
  workersRepresentative: string | null;
  studentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyInput {
  name: string;
  rfc?: string | null;
  employerRepresentative?: string | null;
  workersRepresentative?: string | null;
}

export interface UpdateCompanyInput {
  name?: string;
  rfc?: string | null;
  employerRepresentative?: string | null;
  workersRepresentative?: string | null;
}

export interface ListCompaniesFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedCompaniesResult {
  companies: CompanyListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
