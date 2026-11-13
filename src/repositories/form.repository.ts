import type { PoolClient } from "pg";
import { pool } from "../config/database";

export type FormMode = "admin_applied" | "self";
export const FORM_MODES: readonly FormMode[] = ["admin_applied", "self"];

/** Año calendario de evaluación NOM-035 (México). */
export function currentEvaluationYear(): number {
  return new Date().getFullYear();
}

/** Modo de la guía k en la asignación a (clave ausente = admin_applied). */
const MODE_SQL = (a: string, k: string) => `COALESCE(${a}.form_modes->>${k}, 'admin_applied')`;

export interface FormAssignmentSummary {
  id: string;
  companyId: string;
  formKeys: string[];
  evaluationYear: number;
  dueAt: string | null;
  createdAt: string;
  employeesTotal: number;
  employeesCompleted: number;
  responsesTotal: number;
  responsesCompleted: number;
}

interface AssignmentRow {
  id: string;
  company_id: string;
  form_keys: string[];
  evaluation_year: number;
  due_at: Date | null;
  created_at: Date;
  employees_total: string;
  employees_completed: string;
  responses_total: string;
  responses_completed: string;
}

function mapAssignment(row: AssignmentRow): FormAssignmentSummary {
  return {
    id: row.id,
    companyId: row.company_id,
    formKeys: row.form_keys,
    evaluationYear: Number(row.evaluation_year),
    dueAt: row.due_at ? row.due_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    employeesTotal: Number(row.employees_total),
    employeesCompleted: Number(row.employees_completed),
    responsesTotal: Number(row.responses_total),
    responsesCompleted: Number(row.responses_completed),
  };
}

const ASSIGNMENT_SELECT = `
  SELECT a.id, a.company_id, a.form_keys, a.evaluation_year, a.due_at, a.created_at,
         COUNT(DISTINCT r.student_id) AS employees_total,
         COUNT(DISTINCT r.student_id) FILTER (
           WHERE NOT EXISTS (
             SELECT 1 FROM form_responses r2
             WHERE r2.assignment_id = a.id AND r2.student_id = r.student_id
               AND r2.status <> 'completed'
           )
         ) AS employees_completed,
         COUNT(r.id) AS responses_total,
         COUNT(r.id) FILTER (WHERE r.status = 'completed') AS responses_completed
  FROM form_assignments a
  LEFT JOIN form_responses r ON r.assignment_id = a.id`;

export async function findAssignmentsByCompany(
  companyId: string,
  evaluationYear?: number,
): Promise<FormAssignmentSummary[]> {
  const { rows } = await pool.query<AssignmentRow>(
    `${ASSIGNMENT_SELECT}
     WHERE a.company_id = $1 AND ($2::int IS NULL OR a.evaluation_year = $2)
     GROUP BY a.id
     ORDER BY a.evaluation_year DESC, a.created_at DESC`,
    [companyId, evaluationYear ?? null],
  );
  return rows.map(mapAssignment);
}

/** Años con al menos una guía asignada (I/II/III) a la empresa. */
export async function findCompanyEvaluationYears(companyId: string): Promise<number[]> {
  // Incluye años con Guías I/II/III asignadas y también años solo con Guía V capturada.
  const { rows } = await pool.query<{ y: number }>(
    `SELECT DISTINCT y
       FROM (
         SELECT evaluation_year AS y
           FROM form_assignments
          WHERE company_id = $1
            AND EXISTS (
              SELECT 1 FROM UNNEST(form_keys) AS k WHERE k <> 'nom035_guia5'
            )
         UNION
         SELECT evaluation_year AS y
           FROM employee_guia5_data
          WHERE company_id = $1
            AND answers <> '{}'::jsonb
       ) years
      ORDER BY y DESC`,
    [companyId],
  );
  return rows.map((r) => Number(r.y));
}

export async function countCompanyEmployees(companyId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM students WHERE company_id = $1 AND active = TRUE",
    [companyId],
  );
  return Number(rows[0]?.count ?? 0);
}

/** Muestreo por guía (hoy solo Guía III). */
export type GuideSamplingMeta = {
  mode: "census" | "sample";
  populationN: number;
  sampleN: number;
  stratumField: string;
  selectedStudentIds: string[];
};

/** Crea la asignación y una respuesta pendiente por empleado activo y formulario. */
export async function createAssignment(input: {
  companyId: string;
  formKeys: string[];
  formModes: Record<string, FormMode>;
  evaluationYear: number;
  dueAt: Date | null;
  createdByStaffId: string | null;
  /** Si Guía III va por muestra, solo estos empleados reciben form_responses de esa guía. */
  sampling?: Record<string, GuideSamplingMeta>;
}): Promise<FormAssignmentSummary> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sampling = input.sampling ?? {};
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO form_assignments (company_id, form_keys, form_modes, sampling, evaluation_year, due_at, created_by_staff_id)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
       RETURNING id`,
      [
        input.companyId,
        input.formKeys,
        JSON.stringify(input.formModes),
        JSON.stringify(sampling),
        input.evaluationYear,
        input.dueAt,
        input.createdByStaffId,
      ],
    );
    const assignmentId = rows[0].id;
    const guia3Sample = sampling.nom035_guia3?.mode === "sample"
      ? sampling.nom035_guia3.selectedStudentIds
      : null;
    const keysForAll = guia3Sample
      ? input.formKeys.filter((k) => k !== "nom035_guia3")
      : input.formKeys;
    // Guía V y documentos (Guía IV): no crean respuestas por empleado.
    const responseKeys = keysForAll.filter((k) => k !== "nom035_guia5" && k !== "nom035_guia4");
    if (responseKeys.length > 0) {
      await client.query(
        `INSERT INTO form_responses (assignment_id, student_id, form_key)
         SELECT $1, s.id, k
         FROM students s
         CROSS JOIN UNNEST($2::text[]) AS k
         WHERE s.company_id = $3 AND s.active = TRUE
         ON CONFLICT DO NOTHING`,
        [assignmentId, responseKeys, input.companyId],
      );
    }
    if (guia3Sample && input.formKeys.includes("nom035_guia3")) {
      if (guia3Sample.length > 0) {
        await client.query(
          `INSERT INTO form_responses (assignment_id, student_id, form_key)
           SELECT $1, s.id, 'nom035_guia3'
           FROM students s
           WHERE s.company_id = $2 AND s.active = TRUE
             AND s.id = ANY($3::uuid[])
           ON CONFLICT DO NOTHING`,
          [assignmentId, input.companyId, guia3Sample],
        );
      }
    }
    await client.query("COMMIT");
    const created = await findAssignmentById(assignmentId);
    if (!created) throw new Error("ASSIGNMENT_CREATE_FAILED");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Muestreo de la asignación más reciente que incluye la guía en el año. */
export async function findGuideSampling(
  companyId: string,
  formKey: string,
  evaluationYear: number = currentEvaluationYear(),
): Promise<GuideSamplingMeta | null> {
  const { rows } = await pool.query<{ sampling: Record<string, GuideSamplingMeta> | null }>(
    `SELECT a.sampling
       FROM form_assignments a
      WHERE a.company_id = $1 AND a.evaluation_year = $2
        AND $3 = ANY(a.form_keys)
      ORDER BY a.created_at DESC
      LIMIT 1`,
    [companyId, evaluationYear, formKey],
  );
  const meta = rows[0]?.sampling?.[formKey];
  if (!meta || (meta.mode !== "census" && meta.mode !== "sample")) return null;
  return {
    mode: meta.mode,
    populationN: Number(meta.populationN) || 0,
    sampleN: Number(meta.sampleN) || 0,
    stratumField: meta.stratumField || "sexo",
    selectedStudentIds: Array.isArray(meta.selectedStudentIds)
      ? meta.selectedStudentIds.map(String)
      : [],
  };
}

export async function findAssignmentById(id: string): Promise<FormAssignmentSummary | null> {
  const { rows } = await pool.query<AssignmentRow>(
    `${ASSIGNMENT_SELECT}
     WHERE a.id = $1
     GROUP BY a.id`,
    [id],
  );
  return rows[0] ? mapAssignment(rows[0]) : null;
}

/** Guarda/actualiza los datos de Guía V de un empleado (los captura el admin). */
export async function upsertEmployeeGuia5(input: {
  companyId: string;
  studentId: string;
  answers: Record<string, string>;
  completed: boolean;
  staffId: string | null;
  requiredCount: number;
  evaluationYear?: number;
}, db: Pick<PoolClient, "query"> = pool): Promise<void> {
  const year = input.evaluationYear ?? currentEvaluationYear();
  await db.query(
    `INSERT INTO employee_guia5_data
       (company_id, student_id, evaluation_year, answers, completed, completed_at, updated_by_staff_id)
     VALUES ($1, $2, $3, $4::jsonb, $5, CASE WHEN $5 THEN NOW() ELSE NULL END, $6)
     ON CONFLICT (company_id, student_id, evaluation_year) DO UPDATE SET
       answers = employee_guia5_data.answers || EXCLUDED.answers,
       completed = EXCLUDED.completed
         OR (SELECT COUNT(*) FROM jsonb_object_keys(employee_guia5_data.answers || EXCLUDED.answers)) >= $7,
       completed_at = CASE
         WHEN employee_guia5_data.completed_at IS NOT NULL THEN employee_guia5_data.completed_at
         WHEN EXCLUDED.completed
           OR (SELECT COUNT(*) FROM jsonb_object_keys(employee_guia5_data.answers || EXCLUDED.answers)) >= $7
         THEN NOW() ELSE NULL END,
       updated_by_staff_id = EXCLUDED.updated_by_staff_id,
       updated_at = NOW()`,
    [
      input.companyId,
      input.studentId,
      year,
      JSON.stringify(input.answers),
      input.completed,
      input.staffId,
      input.requiredCount,
    ],
  );
}

export type EmployeeFormStatus =
  | "completed"
  | "partial"
  | "pending"
  | "not_applied"
  | "not_selected";

export interface EmployeeFormState {
  formKey: string;
  status: EmployeeFormStatus;
  /** Respuestas (solo Guías I/II/III completas) para calcular el resultado. */
  answers?: Record<string, string>;
}

/** Estado de formularios por empleado de la empresa (Guía V + última respuesta por guía asignada). */
export async function findCompanyEmployeesFormsSummary(
  companyId: string,
  studentIds?: string[],
  evaluationYear: number = currentEvaluationYear(),
): Promise<Record<string, EmployeeFormState[]>> {
  const filter = studentIds && studentIds.length > 0 ? studentIds : null;
  const { rows } = await pool.query<{
    student_id: string;
    form_key: string;
    status: string;
    answers: Record<string, string> | null;
  }>(
    `SELECT g.student_id, 'nom035_guia5' AS form_key,
            CASE WHEN g.completed THEN 'completed'
                 WHEN g.answers <> '{}'::jsonb THEN 'partial'
                 ELSE 'pending' END AS status,
            NULL::jsonb AS answers
       FROM employee_guia5_data g
      WHERE g.company_id = $1
        AND g.evaluation_year = $3
        AND ($2::uuid[] IS NULL OR g.student_id = ANY($2::uuid[]))
     UNION ALL
     (SELECT DISTINCT ON (r.student_id, r.form_key) r.student_id, r.form_key,
            CASE r.status WHEN 'completed' THEN 'completed'
                          WHEN 'in_progress' THEN 'partial'
                          ELSE 'pending' END,
            CASE WHEN r.status = 'completed' THEN r.answers END
       FROM form_responses r
       JOIN form_assignments a ON a.id = r.assignment_id
      WHERE a.company_id = $1 AND a.evaluation_year = $3 AND r.form_key <> 'nom035_guia5'
        AND ($2::uuid[] IS NULL OR r.student_id = ANY($2::uuid[]))
      ORDER BY r.student_id, r.form_key, a.created_at DESC)
      ORDER BY 1, 2`,
    [companyId, filter, evaluationYear],
  );
  const out: Record<string, EmployeeFormState[]> = {};
  for (const row of rows) {
    (out[row.student_id] ??= []).push({
      formKey: row.form_key,
      status: row.status as EmployeeFormStatus,
      ...(row.answers ? { answers: row.answers } : {}),
    });
  }

  // Formularios que se pueden aplicar y el empleado aún no tiene:
  // Guía V siempre; Guías I/II/III solo si la empresa tiene asignación de esa guía.
  const ids =
    filter ??
    (
      await pool.query<{ id: string }>("SELECT id FROM students WHERE company_id = $1", [companyId])
    ).rows.map((r) => r.id);
  const { rows: assigned } = await pool.query<{ form_key: string }>(
    `SELECT DISTINCT k AS form_key
       FROM form_assignments a CROSS JOIN UNNEST(a.form_keys) AS k
      WHERE a.company_id = $1 AND a.evaluation_year = $2 AND k <> 'nom035_guia5'`,
    [companyId, evaluationYear],
  );
  // Guía IV es documento de empresa: no aparece en íconos/estados por empleado.
  const applicable = [
    "nom035_guia5",
    ...assigned.map((r) => r.form_key).filter((k) => k !== "nom035_guia4"),
  ];
  const order = ["nom035_guia1", "nom035_guia2", "nom035_guia3", "nom035_guia5"];
  const guia3Sampling = assigned.some((r) => r.form_key === "nom035_guia3")
    ? await findGuideSampling(companyId, "nom035_guia3", evaluationYear)
    : null;
  const guia3Selected =
    guia3Sampling?.mode === "sample"
      ? new Set(guia3Sampling.selectedStudentIds)
      : null;
  for (const id of ids) {
    const list = (out[id] ??= []);
    for (const key of applicable) {
      if (list.some((f) => f.formKey === key)) continue;
      if (key === "nom035_guia3" && guia3Selected && !guia3Selected.has(id)) {
        list.push({ formKey: key, status: "not_selected" });
      } else {
        list.push({ formKey: key, status: "not_applied" });
      }
    }
    // Si quedó not_applied por falta de response pero está fuera de muestra, corrige.
    if (guia3Selected && !guia3Selected.has(id)) {
      const g3 = list.find((f) => f.formKey === "nom035_guia3");
      if (g3 && (g3.status === "not_applied" || g3.status === "pending")) {
        g3.status = "not_selected";
        delete g3.answers;
      }
    }
    list.sort((a, b) => order.indexOf(a.formKey) - order.indexOf(b.formKey));
  }
  return out;
}

/** Respuestas cargadas de un formulario para un empleado de la empresa. */
export async function findEmployeeFormAnswers(
  companyId: string,
  studentId: string,
  formKey: string,
  evaluationYear: number = currentEvaluationYear(),
): Promise<{ answers: Record<string, string>; status: EmployeeFormStatus; updatedAt: string | null } | null> {
  if (formKey === "nom035_guia5") {
    const { rows } = await pool.query<{
      answers: Record<string, string>;
      completed: boolean;
      updated_at: Date;
    }>(
      `SELECT answers, completed, updated_at FROM employee_guia5_data
        WHERE company_id = $1 AND student_id = $2 AND evaluation_year = $3
        LIMIT 1`,
      [companyId, studentId, evaluationYear],
    );
    const r = rows[0];
    if (!r) return null;
    const hasAny = Object.keys(r.answers ?? {}).length > 0;
    return {
      answers: r.answers ?? {},
      status: r.completed ? "completed" : hasAny ? "partial" : "pending",
      updatedAt: r.updated_at.toISOString(),
    };
  }
  const { rows } = await pool.query<{
    answers: Record<string, string>;
    status: string;
    updated_at: Date;
  }>(
    `SELECT r.answers, r.status, r.updated_at
       FROM form_responses r
       JOIN form_assignments a ON a.id = r.assignment_id
      WHERE a.company_id = $1 AND r.student_id = $2 AND r.form_key = $3
        AND a.evaluation_year = $4
      ORDER BY a.created_at DESC
      LIMIT 1`,
    [companyId, studentId, formKey, evaluationYear],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    answers: r.answers ?? {},
    status: r.status === "completed" ? "completed" : r.status === "in_progress" ? "partial" : "pending",
    updatedAt: r.updated_at.toISOString(),
  };
}

/**
 * Vincula a la empresa un alumno que existía sin empresa y guarda su Guía V,
 * todo en una transacción. No toca contraseña ni otros datos del alumno.
 * Devuelve false si el alumno ya no está libre (otra carga lo vinculó).
 */
export async function linkStudentToCompanyWithGuia5(input: {
  companyId: string;
  studentId: string;
  guia5: Parameters<typeof upsertEmployeeGuia5>[0] | null;
}): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `UPDATE students SET company_id = $2, updated_at = NOW()
        WHERE id = $1 AND company_id IS NULL`,
      [input.studentId, input.companyId],
    );
    if (!rowCount) {
      await client.query("ROLLBACK");
      return false;
    }
    if (input.guia5) await upsertEmployeeGuia5(input.guia5, client);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Borra un alumno recién creado cuando falla un paso posterior de la misma fila. */
export async function deleteStudentCreatedInImport(studentId: string): Promise<void> {
  await pool.query("DELETE FROM students WHERE id = $1", [studentId]);
}

/** Reemplaza los datos de Guía V de un empleado (edición desde el admin). */
export async function saveEmployeeGuia5(input: {
  companyId: string;
  studentId: string;
  answers: Record<string, string>;
  completed: boolean;
  staffId: string | null;
  evaluationYear?: number;
}): Promise<void> {
  const year = input.evaluationYear ?? currentEvaluationYear();
  await pool.query(
    `INSERT INTO employee_guia5_data
       (company_id, student_id, evaluation_year, answers, completed, completed_at, updated_by_staff_id)
     VALUES ($1, $2, $3, $4::jsonb, $5, CASE WHEN $5 THEN NOW() ELSE NULL END, $6)
     ON CONFLICT (company_id, student_id, evaluation_year) DO UPDATE SET
       answers = EXCLUDED.answers,
       completed = EXCLUDED.completed,
       completed_at = CASE
         WHEN NOT EXCLUDED.completed THEN NULL
         ELSE COALESCE(employee_guia5_data.completed_at, NOW()) END,
       updated_by_staff_id = EXCLUDED.updated_by_staff_id,
       updated_at = NOW()`,
    [input.companyId, input.studentId, year, JSON.stringify(input.answers), input.completed, input.staffId],
  );
}

/** Respuesta del empleado en la asignación más reciente de la empresa que incluye la guía. */
export async function findLatestResponseForEdit(
  companyId: string,
  studentId: string,
  formKey: string,
  evaluationYear: number = currentEvaluationYear(),
): Promise<{
  assignmentId: string;
  mode: FormMode;
  responseId: string | null;
  answers: Record<string, string>;
  status: "pending" | "in_progress" | "completed" | null;
} | null> {
  const { rows } = await pool.query<{ id: string; mode: FormMode }>(
    `SELECT a.id, ${MODE_SQL("a", "$2::text")} AS mode FROM form_assignments a
      WHERE a.company_id = $1 AND $2 = ANY(a.form_keys) AND a.evaluation_year = $3
      ORDER BY a.created_at DESC LIMIT 1`,
    [companyId, formKey, evaluationYear],
  );
  const assignmentId = rows[0]?.id;
  if (!assignmentId) return null;
  const { rows: resp } = await pool.query<{
    id: string;
    answers: Record<string, string>;
    status: "pending" | "in_progress" | "completed";
  }>(
    `SELECT id, answers, status FROM form_responses
      WHERE assignment_id = $1 AND student_id = $2 AND form_key = $3`,
    [assignmentId, studentId, formKey],
  );
  return {
    assignmentId,
    mode: rows[0].mode,
    responseId: resp[0]?.id ?? null,
    answers: resp[0]?.answers ?? {},
    status: resp[0]?.status ?? null,
  };
}

/** Guarda (o crea) la respuesta de un empleado con estado y calificación. */
export async function saveFormResponse(input: {
  assignmentId: string;
  studentId: string;
  formKey: string;
  answers: Record<string, string>;
  status: "pending" | "in_progress" | "completed";
  score: unknown | null;
  onlyIfEmpty?: boolean;
}): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO form_responses
       (assignment_id, student_id, form_key, answers, status, score, started_at, completed_at)
     VALUES ($1, $2, $3, $4::jsonb, $5::varchar, $6::jsonb,
             CASE WHEN $5::varchar <> 'pending' THEN NOW() END,
             CASE WHEN $5::varchar = 'completed' THEN NOW() END)
     ON CONFLICT (assignment_id, student_id, form_key) DO UPDATE SET
       answers = EXCLUDED.answers,
       status = EXCLUDED.status,
       score = EXCLUDED.score,
       started_at = COALESCE(form_responses.started_at, EXCLUDED.started_at),
       completed_at = CASE WHEN EXCLUDED.status = 'completed'
                           THEN COALESCE(form_responses.completed_at, NOW()) ELSE NULL END,
       updated_at = NOW()
     WHERE NOT $7::boolean OR form_responses.answers = '{}'::jsonb`,
    [
      input.assignmentId,
      input.studentId,
      input.formKey,
      JSON.stringify(input.answers),
      input.status,
      input.score == null ? null : JSON.stringify(input.score),
      input.onlyIfEmpty ?? false,
    ],
  );
  return (result.rowCount ?? 0) > 0;
}

export interface CompanyFormResultRow {
  responseId: string;
  studentId: string;
  employeeName: string;
  formKey: string;
  answers: Record<string, string>;
  score: unknown | null;
  completedAt: string | null;
  updatedAt: string;
}

/** Última respuesta completa por empleado y guía (I/II/III) de la empresa. */
export async function findCompanyCompletedResponses(
  companyId: string,
  evaluationYear: number = currentEvaluationYear(),
): Promise<CompanyFormResultRow[]> {
  const { rows } = await pool.query<{
    id: string;
    student_id: string;
    form_key: string;
    answers: Record<string, string>;
    score: unknown | null;
    completed_at: Date | null;
    updated_at: Date;
    paternal_last_name: string | null;
    maternal_last_name: string | null;
    first_names: string | null;
    name: string | null;
  }>(
    `SELECT * FROM (
       SELECT DISTINCT ON (r.student_id, r.form_key)
              r.id, r.student_id, r.form_key, r.answers, r.score, r.completed_at, r.updated_at,
              r.status, s.paternal_last_name, s.maternal_last_name, s.first_names, s.name
         FROM form_responses r
         JOIN form_assignments a ON a.id = r.assignment_id
         JOIN students s ON s.id = r.student_id
        WHERE a.company_id = $1 AND a.evaluation_year = $2 AND r.form_key <> 'nom035_guia5'
        ORDER BY r.student_id, r.form_key, a.created_at DESC
     ) t
     WHERE t.status = 'completed'
     ORDER BY t.paternal_last_name NULLS LAST, t.first_names, t.form_key`,
    [companyId, evaluationYear],
  );
  return rows.map((r) => ({
    responseId: r.id,
    studentId: r.student_id,
    employeeName:
      [r.paternal_last_name, r.maternal_last_name, r.first_names]
        .map((p) => p?.trim())
        .filter(Boolean)
        .join(" ") || r.name || "—",
    formKey: r.form_key,
    answers: r.answers ?? {},
    score: r.score,
    completedAt: r.completed_at ? r.completed_at.toISOString() : null,
    updatedAt: r.updated_at.toISOString(),
  }));
}

/** Actualiza solo la calificación guardada (sin tocar updated_at). */
export async function updateFormResponseScore(responseId: string, score: unknown): Promise<void> {
  await pool.query(`UPDATE form_responses SET score = $2::jsonb WHERE id = $1`, [
    responseId,
    JSON.stringify(score),
  ]);
}

/** Respuestas completas de Guías I/II/III (todas las empresas) para recalcular. */
export async function findAllCompletedResponses(): Promise<
  { id: string; formKey: string; answers: Record<string, string>; score: unknown | null }[]
> {
  const { rows } = await pool.query<{
    id: string;
    form_key: string;
    answers: Record<string, string>;
    score: unknown | null;
  }>(
    `SELECT id, form_key, answers, score FROM form_responses
      WHERE status = 'completed' AND form_key <> 'nom035_guia5'`,
  );
  return rows.map((r) => ({ id: r.id, formKey: r.form_key, answers: r.answers ?? {}, score: r.score }));
}

/** IDs de empleados activos de la empresa (universo para censo/muestra). */
export async function findCompanyActiveEmployeeIds(companyId: string): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(
    "SELECT id FROM students WHERE company_id = $1 AND active = TRUE ORDER BY id",
    [companyId],
  );
  return rows.map((r) => r.id);
}

/** Empleados de la empresa (para el dashboard). */
export async function findCompanyEmployeesBasic(companyId: string): Promise<{ id: string; name: string }[]> {
  const { rows } = await pool.query<{
    id: string;
    paternal_last_name: string | null;
    maternal_last_name: string | null;
    first_names: string | null;
    name: string | null;
  }>(
    `SELECT id, paternal_last_name, maternal_last_name, first_names, name
       FROM students WHERE company_id = $1
      ORDER BY paternal_last_name NULLS LAST, maternal_last_name NULLS LAST, first_names`,
    [companyId],
  );
  return rows.map((r) => ({
    id: r.id,
    name:
      [r.paternal_last_name, r.maternal_last_name, r.first_names]
        .map((p) => p?.trim())
        .filter(Boolean)
        .join(" ") || r.name || "—",
  }));
}

/** Guías asignadas a la empresa (sin Guía V). */
export async function findCompanyAssignedFormKeys(
  companyId: string,
  evaluationYear: number = currentEvaluationYear(),
): Promise<string[]> {
  const { rows } = await pool.query<{ form_key: string }>(
    `SELECT DISTINCT k AS form_key
       FROM form_assignments a CROSS JOIN UNNEST(a.form_keys) AS k
      WHERE a.company_id = $1 AND a.evaluation_year = $2 AND k <> 'nom035_guia5'`,
    [companyId, evaluationYear],
  );
  return rows.map((r) => r.form_key);
}

export interface FormGuideProgress {
  formKey: string;
  mode: FormMode;
  assignmentId: string;
  assignedAt: string;
  dueAt: string | null;
  employeesTotal: number;
  completed: number;
  partial: number;
  pending: number;
  sampling?: GuideSamplingMeta | null;
}

/**
 * Progreso por guía (I/II/III) usando la asignación más reciente que incluye cada guía
 * (misma lógica que la edición). Total = empleados activos de la empresa.
 */
export async function findCompanyGuideProgress(
  companyId: string,
  evaluationYear: number = currentEvaluationYear(),
): Promise<FormGuideProgress[]> {
  const { rows } = await pool.query<{
    form_key: string;
    mode: FormMode;
    assignment_id: string;
    created_at: Date;
    due_at: Date | null;
    sampling: Record<string, GuideSamplingMeta> | null;
    employees_total: string;
    completed: string;
    partial: string;
  }>(
    `WITH latest AS (
       SELECT DISTINCT ON (k) k AS form_key, a.id AS assignment_id, a.created_at, a.due_at,
              a.sampling, ${MODE_SQL("a", "k")} AS mode
         FROM form_assignments a CROSS JOIN UNNEST(a.form_keys) AS k
        WHERE a.company_id = $1 AND a.evaluation_year = $2 AND k <> 'nom035_guia5'
        ORDER BY k, a.created_at DESC
     ), emp AS (
       SELECT id FROM students WHERE company_id = $1 AND active = TRUE
     )
     SELECT l.form_key, l.mode, l.assignment_id, l.created_at, l.due_at, l.sampling,
            (SELECT COUNT(*) FROM emp) AS employees_total,
            COUNT(r.id) FILTER (WHERE r.status = 'completed') AS completed,
            COUNT(r.id) FILTER (WHERE r.status = 'in_progress') AS partial
       FROM latest l
       LEFT JOIN form_responses r
         ON r.assignment_id = l.assignment_id AND r.form_key = l.form_key
        AND r.student_id IN (SELECT id FROM emp)
      GROUP BY l.form_key, l.mode, l.assignment_id, l.created_at, l.due_at, l.sampling
      ORDER BY l.form_key`,
    [companyId, evaluationYear],
  );
  return rows.map((r) => {
    const raw = r.sampling?.[r.form_key];
    const sampling: GuideSamplingMeta | null =
      raw && (raw.mode === "census" || raw.mode === "sample")
        ? {
            mode: raw.mode,
            populationN: Number(raw.populationN) || 0,
            sampleN: Number(raw.sampleN) || 0,
            stratumField: raw.stratumField || "sexo",
            selectedStudentIds: Array.isArray(raw.selectedStudentIds)
              ? raw.selectedStudentIds.map(String)
              : [],
          }
        : null;
    const isDocument = r.form_key === "nom035_guia4";
    const total = isDocument
      ? 0
      : sampling?.mode === "sample"
        ? sampling.sampleN || sampling.selectedStudentIds.length
        : Number(r.employees_total);
    const completed = isDocument ? 0 : Number(r.completed);
    const partial = isDocument ? 0 : Number(r.partial);
    return {
      formKey: r.form_key,
      mode: r.mode,
      assignmentId: r.assignment_id,
      assignedAt: r.created_at.toISOString(),
      dueAt: r.due_at ? r.due_at.toISOString() : null,
      employeesTotal: total,
      completed,
      partial,
      pending: Math.max(total - completed - partial, 0),
      sampling,
    };
  });
}

/** Empleados con respuesta iniciada (parcial o completa) por guía en la empresa. */
export async function findCompanyGuidesInUse(
  companyId: string,
  evaluationYear: number = currentEvaluationYear(),
): Promise<Record<string, number>> {
  const { rows } = await pool.query<{ form_key: string; n: string }>(
    `SELECT r.form_key, COUNT(DISTINCT r.student_id) AS n
       FROM form_responses r
       JOIN form_assignments a ON a.id = r.assignment_id
      WHERE a.company_id = $1 AND a.evaluation_year = $2 AND r.form_key <> 'nom035_guia5'
        AND (r.status <> 'pending' OR r.answers <> '{}'::jsonb)
      GROUP BY r.form_key`,
    [companyId, evaluationYear],
  );
  return Object.fromEntries(rows.map((r) => [r.form_key, Number(r.n)]));
}

/**
 * Quita una guía de la empresa en una transacción: borra sus respuestas vacías, la quita
 * de cada asignación y elimina las asignaciones que queden sin guías.
 * Devuelve el número de empleados que ya la usan (si > 0 no cambia nada).
 */
export async function unassignCompanyGuide(
  companyId: string,
  formKey: string,
  evaluationYear: number = currentEvaluationYear(),
): Promise<{ inUse: number; removed: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: asg } = await client.query<{ id: string }>(
      `SELECT id FROM form_assignments
        WHERE company_id = $1 AND evaluation_year = $3 AND $2 = ANY(form_keys)
        FOR UPDATE`,
      [companyId, formKey, evaluationYear],
    );
    const ids = asg.map((a) => a.id);
    const { rows: used } = await client.query<{ n: string }>(
      `SELECT COUNT(DISTINCT student_id) AS n FROM form_responses
        WHERE assignment_id = ANY($1::uuid[]) AND form_key = $2
          AND (status <> 'pending' OR answers <> '{}'::jsonb)`,
      [ids, formKey],
    );
    const inUse = Number(used[0]?.n ?? 0);
    if (inUse > 0 || ids.length === 0) {
      await client.query("ROLLBACK");
      return { inUse, removed: 0 };
    }
    await client.query(
      `DELETE FROM form_responses WHERE assignment_id = ANY($1::uuid[]) AND form_key = $2`,
      [ids, formKey],
    );
    await client.query(
      `UPDATE form_assignments SET form_keys = array_remove(form_keys, $2::text)
        WHERE id = ANY($1::uuid[])`,
      [ids, formKey],
    );
    await client.query(
      `DELETE FROM form_assignments WHERE id = ANY($1::uuid[]) AND cardinality(form_keys) = 0`,
      [ids],
    );
    await client.query("COMMIT");
    return { inUse: 0, removed: ids.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cambia el modo de una guía en todas las asignaciones de la empresa que la incluyen.
 * Misma regla que desasignar: solo si ningún empleado la ha empezado.
 */
export async function setCompanyGuideMode(
  companyId: string,
  formKey: string,
  mode: FormMode,
  evaluationYear: number = currentEvaluationYear(),
): Promise<{ inUse: number; updated: number }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: asg } = await client.query<{ id: string }>(
      `SELECT id FROM form_assignments
        WHERE company_id = $1 AND evaluation_year = $3 AND $2 = ANY(form_keys)
        FOR UPDATE`,
      [companyId, formKey, evaluationYear],
    );
    const ids = asg.map((a) => a.id);
    const { rows: used } = await client.query<{ n: string }>(
      `SELECT COUNT(DISTINCT student_id) AS n FROM form_responses
        WHERE assignment_id = ANY($1::uuid[]) AND form_key = $2
          AND (status <> 'pending' OR answers <> '{}'::jsonb)`,
      [ids, formKey],
    );
    const inUse = Number(used[0]?.n ?? 0);
    if (inUse > 0 || ids.length === 0) {
      await client.query("ROLLBACK");
      return { inUse, updated: 0 };
    }
    await client.query(
      `UPDATE form_assignments SET form_modes = form_modes || jsonb_build_object($2::text, $3::text)
        WHERE id = ANY($1::uuid[])`,
      [ids, formKey, mode],
    );
    await client.query("COMMIT");
    return { inUse: 0, updated: ids.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface StudentPendingForm {
  formKey: string;
  status: "pending" | "in_progress";
  answeredCount: number;
  dueAt: string | null;
  assignedAt: string;
}

/**
 * Guías que el empleado debe contestar: asignación más reciente por guía de SU empresa,
 * solo modo "self" y que no haya completado. Nunca incluye admin_applied ni Guía V.
 */
export async function findStudentPendingForms(
  companyId: string,
  studentId: string,
): Promise<StudentPendingForm[]> {
  const { rows } = await pool.query<{
    form_key: string;
    status: string | null;
    answers: Record<string, string> | null;
    due_at: Date | null;
    created_at: Date;
  }>(
    `WITH latest AS (
       SELECT DISTINCT ON (k) k AS form_key, a.id AS assignment_id, a.created_at, a.due_at,
              ${MODE_SQL("a", "k")} AS mode
         FROM form_assignments a CROSS JOIN UNNEST(a.form_keys) AS k
        WHERE a.company_id = $1 AND k <> 'nom035_guia5'
        ORDER BY k, a.created_at DESC
     )
     SELECT l.form_key, r.status, r.answers, l.due_at, l.created_at
       FROM latest l
       LEFT JOIN form_responses r
         ON r.assignment_id = l.assignment_id AND r.form_key = l.form_key AND r.student_id = $2
      WHERE l.mode = 'self' AND COALESCE(r.status, 'pending') <> 'completed'
      ORDER BY l.form_key`,
    [companyId, studentId],
  );
  return rows.map((r) => ({
    formKey: r.form_key,
    status: r.status === "in_progress" ? "in_progress" : "pending",
    answeredCount: r.answers ? Object.keys(r.answers).length : 0,
    dueAt: r.due_at ? r.due_at.toISOString() : null,
    assignedAt: r.created_at.toISOString(),
  }));
}

/** Fichas demográficas de los empleados vinculados a una empresa. */
export async function findCompanyDemographics(
  companyId: string,
  evaluationYear: number = currentEvaluationYear(),
) {
  const { rows } = await pool.query<{ student_id: string; answers: Record<string, string>; completed: boolean }>(
    `SELECT student_id, answers, completed FROM employee_guia5_data
      WHERE company_id = $1 AND evaluation_year = $2`,
    [companyId, evaluationYear],
  );
  return rows;
}
