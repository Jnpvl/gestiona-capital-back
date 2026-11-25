import { pool } from "../config/database";
import { AppError } from "../errors/app-error";
import { findCompanyById } from "../repositories/company.repository";
import { findStudentById } from "../repositories/student.repository";
import { findCompanyAssignedFormKeys, findEmployeeFormAnswers, findGuideSampling } from "../repositories/form.repository";
import { findEmployeeReferral } from "../repositories/referral.repository";
import { FORM_DEFINITIONS, scoreForm, type FormAnswers, type FormKey, type FormScoreResult } from "../shared/forms";
import { renderIndividualReport } from "./individual-report-pdf";

export type ReportGuideKey = "nom035_guia1" | "nom035_guia2" | "nom035_guia3" | "nom035_guia5";
export interface ReportGuide {
  key: ReportGuideKey;
  status: string;
  answers: FormAnswers;
  completedAt: string | null;
  score: FormScoreResult | null;
}
export interface IndividualReportData {
  company: NonNullable<Awaited<ReturnType<typeof findCompanyById>>>;
  employee: { id: string; name: string; curp: string | null };
  year: number;
  generatedAt: string;
  riskGuide: "nom035_guia2" | "nom035_guia3" | null;
  guides: ReportGuide[];
  referralStatus: string | null;
}

/** Reads only the requested employee/year. Never recalculates or changes stored results. */
export async function loadIndividualReport(companyId: string, studentId: string, year: number,
  requestedGuide?: "nom035_guia2" | "nom035_guia3"): Promise<IndividualReportData> {
  const [company, employee] = await Promise.all([findCompanyById(companyId), findStudentById(studentId)]);
  if (!company || !employee || employee.companyId !== companyId) {
    throw new AppError(404, "Empleado no encontrado en esta empresa", "EMPLOYEE_NOT_FOUND");
  }
  const [assigned, sampling, referral, dates] = await Promise.all([
    findCompanyAssignedFormKeys(companyId, year), findGuideSampling(companyId, "nom035_guia3", year),
    findEmployeeReferral(companyId, studentId, year),
    pool.query<{ form_key: string; completed_at: Date | null }>(
      `SELECT DISTINCT ON (r.form_key) r.form_key, r.completed_at FROM form_responses r
       JOIN form_assignments a ON a.id = r.assignment_id
       WHERE a.company_id = $1 AND r.student_id = $2 AND a.evaluation_year = $3
       ORDER BY r.form_key, a.created_at DESC, r.updated_at DESC`, [companyId, studentId, year]),
  ]);
  const keys: ReportGuideKey[] = ["nom035_guia1", "nom035_guia2", "nom035_guia3", "nom035_guia5"];
  const guides = await Promise.all(keys.map(async (key): Promise<ReportGuide> => {
    const excluded = key === "nom035_guia3" && sampling?.mode === "sample" && !sampling.selectedStudentIds.includes(studentId);
    const applicable = key === "nom035_guia5" || assigned.includes(key as FormKey);
    const record = applicable && !excluded ? await findEmployeeFormAnswers(companyId, studentId, key, year) : null;
    return { key, status: excluded ? "not_selected" : !applicable ? "not_assigned" : record?.status ?? "pending",
      answers: record?.answers ?? {},
      completedAt: record?.status === "completed" ? dates.rows.find(row => row.form_key === key)?.completed_at?.toISOString() ?? null : null,
      score: record?.status === "completed" && key !== "nom035_guia5" ? scoreForm(FORM_DEFINITIONS[key], record.answers) : null };
  }));
  const riskGuides = guides.filter(g => (g.key === "nom035_guia2" || g.key === "nom035_guia3") && !["not_selected", "not_assigned"].includes(g.status));
  if (requestedGuide && !riskGuides.some(g => g.key === requestedGuide)) {
    throw new AppError(400, "La guía seleccionada no aplica al empleado en este año", "REPORT_GUIDE_NOT_APPLICABLE");
  }
  const completedRisk = riskGuides.filter(g => g.status === "completed");
  if (!requestedGuide && completedRisk.length > 1) throw new AppError(400, "Selecciona Guía II o III para el reporte", "REPORT_GUIDE_REQUIRED");
  const riskGuide = requestedGuide ?? (completedRisk[0]?.key ?? riskGuides[0]?.key ?? null) as IndividualReportData["riskGuide"];
  const included = guides.filter(g => g.key === "nom035_guia1" || g.key === "nom035_guia5" || g.key === riskGuide);
  if (!included.some(g => g.status === "completed" || g.status === "partial")) {
    throw new AppError(409, "No hay respuestas disponibles para generar el reporte de este año", "REPORT_NO_DATA");
  }
  return { company, employee: { id: employee.id, name: employee.name, curp: employee.curp }, year,
    generatedAt: new Date().toISOString(), riskGuide, guides: included, referralStatus: referral?.status ?? null };
}

export async function generateIndividualReport(companyId: string, studentId: string, year: number,
  guide?: "nom035_guia2" | "nom035_guia3") {
  const data = await loadIndividualReport(companyId, studentId, year, guide);
  const name = data.employee.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 100);
  return { bytes: await renderIndividualReport(data), filename: `REPORTE_INDIVIDUAL_NOM035_${name}_${year}${guide ? `_${guide.endsWith("2") ? "II" : "III"}` : ""}.pdf` };
}
