import { pool } from "../config/database";

export type CompanyPsychologistRow = {
  id: string;
  company_id: string;
  name: string;
  license: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
  in_use: boolean;
};

export type EmployeeReferralRow = {
  id: string;
  company_id: string;
  student_id: string;
  evaluation_year: number;
  status: string;
  closure_psychologist_id: string | null;
  conclusion: string | null;
  recommendations: string | null;
  resolution: string | null;
  created_at: Date;
  updated_at: Date;
};

export type EmployeeReferralSessionRow = {
  id: string;
  referral_id: string;
  psychologist_id: string;
  scheduled_at: Date;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function listCompanyPsychologists(companyId: string): Promise<CompanyPsychologistRow[]> {
  const { rows } = await pool.query<CompanyPsychologistRow>(
    `SELECT p.*,
       (
         EXISTS (
           SELECT 1 FROM employee_referral_sessions s
           WHERE s.psychologist_id = p.id
         )
         OR EXISTS (
           SELECT 1 FROM employee_referrals r
           WHERE r.closure_psychologist_id = p.id
         )
       ) AS in_use
     FROM company_psychologists p
     WHERE p.company_id = $1
     ORDER BY LOWER(p.name), p.created_at`,
    [companyId],
  );
  return rows;
}

export async function findCompanyPsychologist(
  companyId: string,
  psychologistId: string,
): Promise<CompanyPsychologistRow | null> {
  const { rows } = await pool.query<CompanyPsychologistRow>(
    `SELECT p.*,
       (
         EXISTS (
           SELECT 1 FROM employee_referral_sessions s
           WHERE s.psychologist_id = p.id
         )
         OR EXISTS (
           SELECT 1 FROM employee_referrals r
           WHERE r.closure_psychologist_id = p.id
         )
       ) AS in_use
     FROM company_psychologists p
     WHERE p.company_id = $1 AND p.id = $2`,
    [companyId, psychologistId],
  );
  return rows[0] ?? null;
}

export async function insertCompanyPsychologist(input: {
  companyId: string;
  name: string;
  license: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}): Promise<CompanyPsychologistRow> {
  const { rows } = await pool.query<CompanyPsychologistRow>(
    `INSERT INTO company_psychologists (company_id, name, license, phone, email, address)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *, FALSE AS in_use`,
    [input.companyId, input.name, input.license, input.phone, input.email, input.address],
  );
  return rows[0];
}

export async function updateCompanyPsychologist(input: {
  companyId: string;
  psychologistId: string;
  name: string;
  license: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}): Promise<CompanyPsychologistRow | null> {
  const { rows } = await pool.query<CompanyPsychologistRow>(
    `UPDATE company_psychologists
     SET name = $3,
         license = $4,
         phone = $5,
         email = $6,
         address = $7,
         updated_at = NOW()
     WHERE company_id = $1 AND id = $2
     RETURNING *,
       (
         EXISTS (
           SELECT 1 FROM employee_referral_sessions s
           WHERE s.psychologist_id = company_psychologists.id
         )
         OR EXISTS (
           SELECT 1 FROM employee_referrals r
           WHERE r.closure_psychologist_id = company_psychologists.id
         )
       ) AS in_use`,
    [
      input.companyId,
      input.psychologistId,
      input.name,
      input.license,
      input.phone,
      input.email,
      input.address,
    ],
  );
  return rows[0] ?? null;
}

export async function deleteCompanyPsychologist(companyId: string, psychologistId: string) {
  const { rowCount } = await pool.query(
    `DELETE FROM company_psychologists WHERE company_id = $1 AND id = $2`,
    [companyId, psychologistId],
  );
  return (rowCount ?? 0) > 0;
}

export async function findEmployeeReferral(
  companyId: string,
  studentId: string,
  evaluationYear: number,
): Promise<EmployeeReferralRow | null> {
  const { rows } = await pool.query<EmployeeReferralRow>(
    `SELECT * FROM employee_referrals
     WHERE company_id = $1 AND student_id = $2 AND evaluation_year = $3`,
    [companyId, studentId, evaluationYear],
  );
  return rows[0] ?? null;
}

/** Estatus de canalización por empleado para un año (dashboard). */
export async function listCompanyReferralStatuses(
  companyId: string,
  evaluationYear: number,
): Promise<Map<string, string>> {
  const { rows } = await pool.query<{ student_id: string; status: string }>(
    `SELECT student_id, status
     FROM employee_referrals
     WHERE company_id = $1 AND evaluation_year = $2`,
    [companyId, evaluationYear],
  );
  return new Map(rows.map((row) => [row.student_id, row.status]));
}

export async function upsertEmployeeReferral(input: {
  companyId: string;
  studentId: string;
  evaluationYear: number;
  status: string;
  closurePsychologistId: string | null;
  conclusion: string | null;
  recommendations: string | null;
  resolution: string | null;
}): Promise<EmployeeReferralRow> {
  const { rows } = await pool.query<EmployeeReferralRow>(
    `INSERT INTO employee_referrals (
       company_id, student_id, evaluation_year, status,
       closure_psychologist_id, conclusion, recommendations, resolution
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (company_id, student_id, evaluation_year) DO UPDATE SET
       status = EXCLUDED.status,
       closure_psychologist_id = EXCLUDED.closure_psychologist_id,
       conclusion = EXCLUDED.conclusion,
       recommendations = EXCLUDED.recommendations,
       resolution = EXCLUDED.resolution,
       updated_at = NOW()
     RETURNING *`,
    [
      input.companyId,
      input.studentId,
      input.evaluationYear,
      input.status,
      input.closurePsychologistId,
      input.conclusion,
      input.recommendations,
      input.resolution,
    ],
  );
  return rows[0];
}

export async function listReferralSessions(referralId: string): Promise<EmployeeReferralSessionRow[]> {
  const { rows } = await pool.query<EmployeeReferralSessionRow>(
    `SELECT * FROM employee_referral_sessions
     WHERE referral_id = $1
     ORDER BY scheduled_at, created_at`,
    [referralId],
  );
  return rows;
}

export async function replaceReferralSessions(
  referralId: string,
  sessions: {
    psychologistId: string;
    scheduledAt: string;
    status: string;
    notes: string | null;
  }[],
): Promise<EmployeeReferralSessionRow[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM employee_referral_sessions WHERE referral_id = $1`, [referralId]);
    const saved: EmployeeReferralSessionRow[] = [];
    for (const session of sessions) {
      const { rows } = await client.query<EmployeeReferralSessionRow>(
        `INSERT INTO employee_referral_sessions
           (referral_id, psychologist_id, scheduled_at, status, notes)
         VALUES ($1, $2, $3::timestamptz, $4, $5)
         RETURNING *`,
        [referralId, session.psychologistId, session.scheduledAt, session.status, session.notes],
      );
      saved.push(rows[0]);
    }
    await client.query("COMMIT");
    return saved;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
