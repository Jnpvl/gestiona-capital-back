export interface CompanyRecord {
  address_street: string | null;
  address_exterior_number: string | null;
  address_interior_number: string | null;
  address_neighborhood: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_municipality: string | null;
  address_state: string | null;
  address_country: string | null;
  address_between_street_1: string | null;
  address_between_street_2: string | null;
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
  activity_main: string | null;
  address: string | null;
}

export interface CompanyListItem {
  activityMain: string | null;
  id: string;
  name: string;
  rfc: string | null;
  employerRepresentative: string | null;
  studentsCount: number;
  createdAt: string;
}

export interface CompanyDetail {
  addressStreet: string | null;
  addressExteriorNumber: string | null;
  addressInteriorNumber: string | null;
  addressNeighborhood: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  addressMunicipality: string | null;
  addressState: string | null;
  addressCountry: string | null;
  addressBetweenStreet1: string | null;
  addressBetweenStreet2: string | null;
  id: string;
  name: string;
  rfc: string | null;
  employerRepresentative: string | null;
  workersRepresentative: string | null;
  workersCount: number | null;
  address: string | null;
  /** Actividad principal del negocio. */
  activityMain: string | null;
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
  activityMain?: string | null;
  address?: string | null;
  addressStreet?: string | null;
  addressExteriorNumber?: string | null;
  addressInteriorNumber?: string | null;
  addressNeighborhood?: string | null;
  addressPostalCode?: string | null;
  addressCity?: string | null;
  addressMunicipality?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
  addressBetweenStreet1?: string | null;
  addressBetweenStreet2?: string | null;
}

export interface UpdateCompanyInput {
  name?: string;
  rfc?: string | null;
  employerRepresentative?: string | null;
  workersRepresentative?: string | null;
  workersCount?: number | null;
  activityMain?: string | null;
  address?: string | null;
  addressStreet?: string | null;
  addressExteriorNumber?: string | null;
  addressInteriorNumber?: string | null;
  addressNeighborhood?: string | null;
  addressPostalCode?: string | null;
  addressCity?: string | null;
  addressMunicipality?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
  addressBetweenStreet1?: string | null;
  addressBetweenStreet2?: string | null;
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
