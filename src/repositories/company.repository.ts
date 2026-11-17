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
    activityMain: row.activity_main,
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
    address: row.address ?? null,
    addressStreet: row.address_street ?? null,
    addressExteriorNumber: row.address_exterior_number ?? null,
    addressInteriorNumber: row.address_interior_number ?? null,
    addressNeighborhood: row.address_neighborhood ?? null,
    addressPostalCode: row.address_postal_code ?? null,
    addressCity: row.address_city ?? null,
    addressMunicipality: row.address_municipality ?? null,
    addressState: row.address_state ?? null,
    addressCountry: row.address_country ?? null,
    addressBetweenStreet1: row.address_between_street_1 ?? null,
    addressBetweenStreet2: row.address_between_street_2 ?? null,
    activityMain: row.activity_main,
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
       employer_representative, workers_representative, workers_count, activity_main, address,
       address_street, address_exterior_number, address_interior_number, address_neighborhood, address_postal_code, address_city, address_municipality, address_state, address_country, address_between_street_1, address_between_street_2
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING *`,
    [
      trimmedName,
      normalized,
      input.rfc?.trim().toUpperCase() || null,
      input.employerRepresentative?.trim() || null,
      input.workersRepresentative?.trim() || null,
      input.workersCount ?? null,
      input.activityMain?.trim() || null,
      input.address?.trim() || null,
      input.addressStreet?.trim() || null,
      input.addressExteriorNumber?.trim() || null,
      input.addressInteriorNumber?.trim() || null,
      input.addressNeighborhood?.trim() || null,
      input.addressPostalCode?.trim() || null,
      input.addressCity?.trim() || null,
      input.addressMunicipality?.trim() || null,
      input.addressState?.trim() || null,
      input.addressCountry?.trim() || null,
      input.addressBetweenStreet1?.trim() || null,
      input.addressBetweenStreet2?.trim() || null,
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
         activity_main = $8,
         address = $9,
         address_street = $10,
         address_exterior_number = $11,
         address_interior_number = $12,
         address_neighborhood = $13,
         address_postal_code = $14,
         address_city = $15,
         address_municipality = $16,
         address_state = $17,
         address_country = $18,
         address_between_street_1 = $19,
         address_between_street_2 = $20,
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
      input.activityMain !== undefined ? input.activityMain?.trim() || null : current.activityMain,
      input.address !== undefined ? input.address?.trim() || null : current.address,
      input.addressStreet !== undefined ? input.addressStreet?.trim() || null : current.addressStreet,
      input.addressExteriorNumber !== undefined ? input.addressExteriorNumber?.trim() || null : current.addressExteriorNumber,
      input.addressInteriorNumber !== undefined ? input.addressInteriorNumber?.trim() || null : current.addressInteriorNumber,
      input.addressNeighborhood !== undefined ? input.addressNeighborhood?.trim() || null : current.addressNeighborhood,
      input.addressPostalCode !== undefined ? input.addressPostalCode?.trim() || null : current.addressPostalCode,
      input.addressCity !== undefined ? input.addressCity?.trim() || null : current.addressCity,
      input.addressMunicipality !== undefined ? input.addressMunicipality?.trim() || null : current.addressMunicipality,
      input.addressState !== undefined ? input.addressState?.trim() || null : current.addressState,
      input.addressCountry !== undefined ? input.addressCountry?.trim() || null : current.addressCountry,
      input.addressBetweenStreet1 !== undefined ? input.addressBetweenStreet1?.trim() || null : current.addressBetweenStreet1,
      input.addressBetweenStreet2 !== undefined ? input.addressBetweenStreet2?.trim() || null : current.addressBetweenStreet2,
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

export interface CompanyCourseSummary {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  deliveryModes: ("online" | "presencial")[];
  activeCount: number;
  completedCount: number;
  employeesTotal: number;
  firstEnrolledAt: string | null;
  lastEnrolledAt: string | null;
}

/** Cursos con al menos una inscripción activa «con empresa» de empleados de la empresa. */
export async function findCompanyCourseSummaries(companyId: string): Promise<CompanyCourseSummary[]> {
  const { rows } = await pool.query<{
    course_id: string;
    course_title: string;
    course_slug: string;
    delivery_modes: ("online" | "presencial")[];
    active_count: string;
    completed_count: string;
    employees_total: string;
    first_enrolled_at: Date | null;
    last_enrolled_at: Date | null;
  }>(
    `WITH emp AS (
       SELECT id FROM students WHERE company_id = $1 AND active = TRUE
     )
     SELECT c.id AS course_id,
            c.title AS course_title,
            c.slug AS course_slug,
            ARRAY_AGG(DISTINCT e.delivery_mode ORDER BY e.delivery_mode) AS delivery_modes,
            COUNT(*)::text AS active_count,
            COUNT(*) FILTER (WHERE e.completed_at IS NOT NULL)::text AS completed_count,
            (SELECT COUNT(*) FROM emp)::text AS employees_total,
            MIN(e.enrolled_at) AS first_enrolled_at,
            MAX(e.enrolled_at) AS last_enrolled_at
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN courses c ON c.id = e.course_id
      WHERE s.company_id = $1
        AND e.enrolled_via_company = TRUE
        AND e.status = 'active'
      GROUP BY c.id, c.title, c.slug
      ORDER BY MAX(e.enrolled_at) DESC`,
    [companyId],
  );

  return rows.map((row) => ({
    courseId: row.course_id,
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
    deliveryModes: row.delivery_modes ?? [],
    activeCount: Number(row.active_count),
    completedCount: Number(row.completed_count),
    employeesTotal: Number(row.employees_total),
    firstEnrolledAt: row.first_enrolled_at?.toISOString() ?? null,
    lastEnrolledAt: row.last_enrolled_at?.toISOString() ?? null,
  }));
}

export interface CompanyEmployeeForCourseAssign {
  id: string;
  name: string;
  email: string;
  curp: string | null;
  stpsOccupationCode: string | null;
}

/** Empleados activos de la empresa para asignación masiva de cursos. */
export async function findCompanyActiveEmployeesForCourses(
  companyId: string,
): Promise<CompanyEmployeeForCourseAssign[]> {
  const { rows } = await pool.query<{
    id: string;
    paternal_last_name: string | null;
    maternal_last_name: string | null;
    first_names: string | null;
    name: string | null;
    email: string;
    curp: string | null;
    stps_occupation_code: string | null;
  }>(
    `SELECT id, paternal_last_name, maternal_last_name, first_names, name, email, curp, stps_occupation_code
       FROM students
      WHERE company_id = $1 AND active = TRUE
      ORDER BY paternal_last_name NULLS LAST, maternal_last_name NULLS LAST, first_names`,
    [companyId],
  );

  return rows.map((row) => ({
    id: row.id,
    name:
      [row.paternal_last_name, row.maternal_last_name, row.first_names]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ") ||
      row.name ||
      "—",
    email: row.email,
    curp: row.curp,
    stpsOccupationCode: row.stps_occupation_code,
  }));
}
