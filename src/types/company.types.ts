export interface CompanyRecord {
  id: string;
  name: string;
  name_normalized: string;
  rfc: string | null;
  employer_representative: string | null;
  workers_representative: string | null;
  workers_count: number | null;
  access_email: string | null;
  password_hash: string | null;
  access_active: boolean;
  last_login_at: Date | null;
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
  workersCount: number | null;
  /** Correo de acceso al portal de empresa (null si no tiene acceso). */
  accessEmail: string | null;
  hasAccess: boolean;
  lastLoginAt: string | null;
  studentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyAccessInput {
  accessEmail: string;
  password?: string | null;
  sendAccessEmail?: boolean;
}

export interface CreateCompanyInput {
  name: string;
  accessEmail?: string | null;
  password?: string | null;
  sendAccessEmail?: boolean;
  rfc?: string | null;
  employerRepresentative?: string | null;
  workersRepresentative?: string | null;
  workersCount?: number | null;
}

export interface UpdateCompanyInput {
  name?: string;
  rfc?: string | null;
  employerRepresentative?: string | null;
  workersRepresentative?: string | null;
  workersCount?: number | null;
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
