import bcrypt from "bcrypt";
import { pool } from "../config/database";
import type {
  CompanyDetail,
  CompanyListItem,
  CompanyRecord,
  CreateCompanyInput,
  ListCompaniesFilters,
  PaginatedCompaniesResult,
  UpdateCompanyInput,
} from "../types/company.types";

export function normalizeCompanyName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapListItem(
  row: CompanyRecord & { students_count: string },
): CompanyListItem {
  return {
    id: row.id,
    name: row.name,
    rfc: row.rfc,
    employerRepresentative: row.employer_representative,
    studentsCount: Number(row.students_count),
    createdAt: row.created_at.toISOString(),
  };
}

function mapDetail(row: CompanyRecord & { students_count: string }): CompanyDetail {
  return {
    id: row.id,
    name: row.name,
    rfc: row.rfc,
    employerRepresentative: row.employer_representative,
    workersRepresentative: row.workers_representative,
    workersCount: row.workers_count,
    accessEmail: row.access_email,
    hasAccess: !!row.access_email && !!row.password_hash,
    lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
    studentsCount: Number(row.students_count),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findCompanyByNormalizedName(
  normalizedName: string,
): Promise<CompanyRecord | null> {
  const { rows } = await pool.query<CompanyRecord>(
    `SELECT * FROM companies WHERE name_normalized = $1 LIMIT 1`,
    [normalizedName],
  );
  return rows[0] ?? null;
}

export async function listCompanies(search?: string, limit = 50): Promise<CompanyListItem[]> {
  const result = await findCompaniesPaginated({ search, page: 1, limit });
  return result.companies;
}

function buildWhereClause(filters: ListCompaniesFilters) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.search?.trim()) {
    values.push(`%${normalizeCompanyName(filters.search)}%`);
    const index = values.length;
    conditions.push(
      `(c.name_normalized LIKE $${index} OR UPPER(c.rfc) LIKE UPPER($${index}))`,
    );
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, values };
}

export async function findCompaniesPaginated(
  filters: ListCompaniesFilters = {},
): Promise<PaginatedCompaniesResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
  const offset = (page - 1) * limit;

  const { where, values } = buildWhereClause(filters);

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM companies c ${where}`,
    values,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const listValues = [...values, limit, offset];
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  const { rows } = await pool.query<CompanyRecord & { students_count: string }>(
    `SELECT c.*,
            COUNT(s.id)::text AS students_count
     FROM companies c
     LEFT JOIN students s ON s.company_id = c.id
     ${where}
     GROUP BY c.id
     ORDER BY c.name ASC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    listValues,
  );

  return {
    companies: rows.map(mapListItem),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function findCompanyById(id: string): Promise<CompanyDetail | null> {
  const { rows } = await pool.query<CompanyRecord & { students_count: string }>(
    `SELECT c.*,
            COUNT(s.id)::text AS students_count
     FROM companies c
     LEFT JOIN students s ON s.company_id = c.id
     WHERE c.id = $1
     GROUP BY c.id
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapDetail(rows[0]) : null;
}

export async function createCompany(input: CreateCompanyInput): Promise<CompanyDetail> {
  const trimmedName = input.name.trim();
  const normalized = normalizeCompanyName(trimmedName);

  const { rows } = await pool.query<CompanyRecord>(
    `INSERT INTO companies (
       name, name_normalized, rfc,
       employer_representative, workers_representative, workers_count
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      trimmedName,
      normalized,
      input.rfc?.trim().toUpperCase() || null,
      input.employerRepresentative?.trim() || null,
      input.workersRepresentative?.trim() || null,
      input.workersCount ?? null,
    ],
  );

  const created = await findCompanyById(rows[0].id);
  if (!created) {
    throw new Error("COMPANY_CREATE_FAILED");
  }

  return created;
}

export async function updateCompany(
  id: string,
  input: UpdateCompanyInput,
): Promise<CompanyDetail | null> {
  const current = await findCompanyById(id);
  if (!current) return null;

  const name = input.name?.trim() ?? current.name;
  const normalized = normalizeCompanyName(name);

  const { rows } = await pool.query<CompanyRecord>(
    `UPDATE companies
     SET name = $1,
         name_normalized = $2,
         rfc = $3,
         employer_representative = $4,
         workers_representative = $5,
         workers_count = $7,
         updated_at = NOW()
     WHERE id = $6
     RETURNING id`,
    [
      name,
      normalized,
      input.rfc !== undefined ? input.rfc?.trim().toUpperCase() || null : current.rfc,
      input.employerRepresentative !== undefined
        ? input.employerRepresentative?.trim() || null
        : current.employerRepresentative,
      input.workersRepresentative !== undefined
        ? input.workersRepresentative?.trim() || null
        : current.workersRepresentative,
      id,
      input.workersCount !== undefined ? input.workersCount ?? null : current.workersCount,
    ],
  );

  return rows[0] ? findCompanyById(rows[0].id) : null;
}

/** Empresa por correo de acceso (login de empresa). */
export async function findCompanyByAccessEmail(email: string): Promise<CompanyRecord | null> {
  const { rows } = await pool.query<CompanyRecord>(
    "SELECT * FROM companies WHERE LOWER(access_email) = LOWER($1) LIMIT 1",
    [email.trim()],
  );
  return rows[0] ?? null;
}

export async function findCompanyRecordById(id: string): Promise<CompanyRecord | null> {
  const { rows } = await pool.query<CompanyRecord>("SELECT * FROM companies WHERE id = $1", [id]);
  return rows[0] ?? null;
}

/** Guarda correo de acceso y, si viene, una contraseña nueva (bcrypt, igual que alumnos). */
export async function setCompanyAccess(
  id: string,
  input: { accessEmail: string; password?: string | null },
): Promise<void> {
  const hash = input.password ? await bcrypt.hash(input.password, 12) : null;
  await pool.query(
    `UPDATE companies
        SET access_email = LOWER($2),
            password_hash = COALESCE($3, password_hash),
            updated_at = NOW()
      WHERE id = $1`,
    [id, input.accessEmail.trim(), hash],
  );
}

export async function verifyCompanyPassword(company: CompanyRecord, password: string): Promise<boolean> {
  if (!company.password_hash) return false;
  return bcrypt.compare(password, company.password_hash);
}

export async function touchCompanyLogin(id: string): Promise<void> {
  await pool.query("UPDATE companies SET last_login_at = NOW() WHERE id = $1", [id]);
}
