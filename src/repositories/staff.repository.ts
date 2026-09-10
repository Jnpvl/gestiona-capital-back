import bcrypt from "bcrypt";
import { pool } from "../config/database";
import { formatStaffFullName } from "../shared/utils/staff-name";
import type {
  CreateStaffInput,
  ListStaffFilters,
  PaginatedStaffResult,
  StaffProfile,
  StaffPublic,
  StaffRecord,
  UpdateStaffInput,
} from "../types/staff.types";

function mapStaffPublic(staff: StaffRecord): StaffPublic {
  return {
    id: staff.id,
    name: staff.name,
    paternalLastName: staff.paternal_last_name ?? "",
    maternalLastName: staff.maternal_last_name,
    firstNames: staff.first_names ?? "",
    email: staff.email,
    role: staff.role,
    age: staff.age,
    gender: staff.gender,
    aceStpsRegistration: staff.ace_stps_registration,
    photoUrl: staff.photo_url,
    logoUrl: staff.logo_url,
    signatureUrl: staff.signature_url,
    career: staff.career,
    professionalArea: staff.professional_area,
    active: staff.active,
    privacyAccepted: Boolean(staff.privacy_accepted_at),
    createdAt: staff.created_at.toISOString(),
  };
}

function mapStaffProfile(staff: StaffRecord): StaffProfile {
  return {
    ...mapStaffPublic(staff),
    renapConocer: staff.renap_conocer,
    professionalLicense: staff.professional_license,
    professionalBio: staff.professional_bio,
    updatedAt: staff.updated_at.toISOString(),
  };
}

function resolveNameParts(input: {
  paternalLastName?: string;
  maternalLastName?: string | null;
  firstNames?: string;
}) {
  return {
    paternalLastName: input.paternalLastName?.trim() ?? "",
    maternalLastName: input.maternalLastName?.trim() || null,
    firstNames: input.firstNames?.trim() ?? "",
  };
}

export async function findStaffByEmail(email: string): Promise<StaffRecord | null> {
  const { rows } = await pool.query<StaffRecord>(
    "SELECT * FROM staff WHERE email = $1 LIMIT 1",
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function findStaffById(id: string): Promise<StaffRecord | null> {
  const { rows } = await pool.query<StaffRecord>(
    "SELECT * FROM staff WHERE id = $1 LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function findStaffProfileById(id: string): Promise<StaffProfile | null> {
  const staff = await findStaffById(id);
  return staff ? mapStaffProfile(staff) : null;
}

export async function createStaff(input: CreateStaffInput): Promise<StaffProfile> {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const nameParts = resolveNameParts(input);
  const fullName = formatStaffFullName(nameParts);

  const { rows } = await pool.query<StaffRecord>(
    `INSERT INTO staff (
       name, paternal_last_name, maternal_last_name, first_names, email, password_hash, role,
       age, gender, ace_stps_registration, renap_conocer, professional_license, photo_url, logo_url, signature_url,
       career, professional_area, professional_bio, active
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING *`,
    [
      fullName,
      nameParts.paternalLastName,
      nameParts.maternalLastName,
      nameParts.firstNames,
      input.email.toLowerCase().trim(),
      passwordHash,
      input.role,
      input.age ?? null,
      input.gender ?? null,
      input.aceStpsRegistration?.trim() || null,
      input.renapConocer?.trim() || null,
      input.professionalLicense?.trim() || null,
      input.photoUrl?.trim() || null,
      input.logoUrl?.trim() || null,
      input.signatureUrl?.trim() || null,
      input.career?.trim() || null,
      input.professionalArea?.trim() || null,
      input.professionalBio?.trim() || null,
      input.active ?? true,
    ],
  );
  return mapStaffProfile(rows[0]);
}

function buildWhereClause(filters: ListStaffFilters) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.excludeSuperAdmin) {
    conditions.push(`role <> 'super_admin'`);
  }

  if (filters.active !== undefined) {
    values.push(filters.active);
    conditions.push(`active = $${values.length}`);
  }

  if (filters.role) {
    values.push(filters.role);
    conditions.push(`role = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search.toLowerCase()}%`);
    const index = values.length;
    conditions.push(
      `(LOWER(name) LIKE $${index}
        OR LOWER(email) LIKE $${index}
        OR LOWER(paternal_last_name) LIKE $${index}
        OR LOWER(maternal_last_name) LIKE $${index}
        OR LOWER(first_names) LIKE $${index})`,
    );
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, values };
}

export async function findStaffPaginated(
  filters: ListStaffFilters = {},
): Promise<PaginatedStaffResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
  const offset = (page - 1) * limit;

  const { where, values } = buildWhereClause(filters);

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM staff ${where}`,
    values,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const listValues = [...values, limit, offset];
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  const { rows } = await pool.query<StaffRecord>(
    `SELECT * FROM staff ${where}
     ORDER BY created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    listValues,
  );

  return {
    staff: rows.map(mapStaffPublic),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function updateStaff(
  id: string,
  input: UpdateStaffInput,
): Promise<StaffProfile | null> {
  const current = await findStaffById(id);
  if (!current) return null;

  const passwordHash = input.password
    ? await bcrypt.hash(input.password, 12)
    : current.password_hash;

  const nameParts = resolveNameParts({
    paternalLastName: input.paternalLastName ?? current.paternal_last_name ?? "",
    maternalLastName:
      input.maternalLastName !== undefined ? input.maternalLastName : current.maternal_last_name,
    firstNames: input.firstNames ?? current.first_names ?? "",
  });
  const fullName = formatStaffFullName(nameParts);

  const { rows } = await pool.query<StaffRecord>(
    `UPDATE staff
     SET name = $1,
         paternal_last_name = $2,
         maternal_last_name = $3,
         first_names = $4,
         email = $5,
         password_hash = $6,
         role = $7,
         age = $8,
         gender = $9,
         ace_stps_registration = $10,
         renap_conocer = $11,
         professional_license = $12,
         photo_url = $13,
         logo_url = $14,
         signature_url = $15,
         career = $16,
         professional_area = $17,
         professional_bio = $18,
         active = $19,
         updated_at = NOW()
     WHERE id = $20
     RETURNING *`,
    [
      fullName,
      nameParts.paternalLastName,
      nameParts.maternalLastName,
      nameParts.firstNames,
      (input.email ?? current.email).toLowerCase().trim(),
      passwordHash,
      input.role ?? current.role,
      input.age !== undefined ? input.age : current.age,
      input.gender !== undefined ? input.gender : current.gender,
      input.aceStpsRegistration !== undefined
        ? input.aceStpsRegistration?.trim() || null
        : current.ace_stps_registration,
      input.renapConocer !== undefined
        ? input.renapConocer?.trim() || null
        : current.renap_conocer,
      input.professionalLicense !== undefined
        ? input.professionalLicense?.trim() || null
        : current.professional_license,
      input.photoUrl !== undefined ? input.photoUrl?.trim() || null : current.photo_url,
      input.logoUrl !== undefined ? input.logoUrl?.trim() || null : current.logo_url,
      input.signatureUrl !== undefined ? input.signatureUrl?.trim() || null : current.signature_url,
      input.career !== undefined ? input.career?.trim() || null : current.career,
      input.professionalArea !== undefined
        ? input.professionalArea?.trim() || null
        : current.professional_area,
      input.professionalBio !== undefined
        ? input.professionalBio?.trim() || null
        : current.professional_bio,
      input.active ?? current.active,
      id,
    ],
  );

  return rows[0] ? mapStaffProfile(rows[0]) : null;
}

export async function setStaffActive(
  id: string,
  active: boolean,
): Promise<StaffProfile | null> {
  const { rows } = await pool.query<StaffRecord>(
    `UPDATE staff SET active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [active, id],
  );
  return rows[0] ? mapStaffProfile(rows[0]) : null;
}

export async function verifyStaffPassword(
  staff: StaffRecord,
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, staff.password_hash);
}

export function toStaffPublic(staff: StaffRecord): StaffPublic {
  return mapStaffPublic(staff);
}
