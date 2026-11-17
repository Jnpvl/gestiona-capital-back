import { AppError } from "../errors/app-error";
import { findCompanyById } from "../repositories/company.repository";
import {
  deleteCompanyPsychologist,
  findCompanyPsychologist,
  findEmployeeReferral,
  insertCompanyPsychologist,
  listCompanyPsychologists,
  listReferralSessions,
  replaceReferralSessions,
  updateCompanyPsychologist,
  upsertEmployeeReferral,
  type CompanyPsychologistRow,
} from "../repositories/referral.repository";
import { findStudentById } from "../repositories/student.repository";

function mapPsychologist(row: CompanyPsychologistRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    license: row.license,
    phone: row.phone,
    email: row.email,
    address: row.address,
    inUse: Boolean(row.in_use),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

async function assertCompany(companyId: string) {
  const company = await findCompanyById(companyId);
  if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
  return company;
}

async function assertEmployee(companyId: string, studentId: string) {
  const student = await findStudentById(studentId).catch(() => null);
  if (!student || student.companyId !== companyId) {
    throw new AppError(404, "Empleado no encontrado", "EMPLOYEE_NOT_FOUND");
  }
  return student;
}

export class ReferralService {
  async listPsychologists(companyId: string) {
    await assertCompany(companyId);
    const psychologists = await listCompanyPsychologists(companyId);
    return { psychologists: psychologists.map(mapPsychologist) };
  }

  async createPsychologist(
    companyId: string,
    input: {
      name: string;
      license: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
    },
  ) {
    await assertCompany(companyId);
    try {
      const psychologist = await insertCompanyPsychologist({
        companyId,
        name: input.name.trim(),
        license: input.license.trim(),
        phone: normalizeOptional(input.phone),
        email: normalizeOptional(input.email),
        address: normalizeOptional(input.address),
      });
      return { psychologist: mapPsychologist(psychologist) };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new AppError(409, "Ya hay un psicólogo con esa cédula", "PSYCHOLOGIST_LICENSE_EXISTS");
      }
      throw error;
    }
  }

  async updatePsychologist(
    companyId: string,
    psychologistId: string,
    input: {
      name: string;
      license: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
    },
  ) {
    await assertCompany(companyId);
    const current = await findCompanyPsychologist(companyId, psychologistId);
    if (!current) throw new AppError(404, "Psicólogo no encontrado", "PSYCHOLOGIST_NOT_FOUND");
    if (current.in_use) {
      throw new AppError(
        409,
        "No puedes editar un psicólogo que ya está en uso en sesiones o cierres",
        "PSYCHOLOGIST_IN_USE",
      );
    }
    try {
      const psychologist = await updateCompanyPsychologist({
        companyId,
        psychologistId,
        name: input.name.trim(),
        license: input.license.trim(),
        phone: normalizeOptional(input.phone),
        email: normalizeOptional(input.email),
        address: normalizeOptional(input.address),
      });
      if (!psychologist) throw new AppError(404, "Psicólogo no encontrado", "PSYCHOLOGIST_NOT_FOUND");
      return { psychologist: mapPsychologist(psychologist) };
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new AppError(409, "Ya hay un psicólogo con esa cédula", "PSYCHOLOGIST_LICENSE_EXISTS");
      }
      throw error;
    }
  }

  async deletePsychologist(companyId: string, psychologistId: string) {
    await assertCompany(companyId);
    const current = await findCompanyPsychologist(companyId, psychologistId);
    if (!current) throw new AppError(404, "Psicólogo no encontrado", "PSYCHOLOGIST_NOT_FOUND");
    if (current.in_use) {
      throw new AppError(
        409,
        "No puedes eliminar un psicólogo que ya está en uso en sesiones o cierres",
        "PSYCHOLOGIST_IN_USE",
      );
    }
    await deleteCompanyPsychologist(companyId, psychologistId);
    return { ok: true };
  }

  async getEmployeeReferral(companyId: string, studentId: string, evaluationYear: number) {
    await assertCompany(companyId);
    await assertEmployee(companyId, studentId);
    const [psychologists, referral] = await Promise.all([
      listCompanyPsychologists(companyId),
      findEmployeeReferral(companyId, studentId, evaluationYear),
    ]);
    const sessions = referral ? await listReferralSessions(referral.id) : [];
    return {
      psychologists: psychologists.map(mapPsychologist),
      referral: referral
        ? {
            id: referral.id,
            status: referral.status,
            evaluationYear: referral.evaluation_year,
            closure: {
              psychologistId: referral.closure_psychologist_id,
              conclusion: referral.conclusion,
              recommendations: referral.recommendations,
              resolution: referral.resolution,
            },
            sessions: sessions.map((session) => ({
              id: session.id,
              psychologistId: session.psychologist_id,
              datetime: session.scheduled_at.toISOString(),
              status: session.status,
              notes: session.notes,
            })),
            updatedAt: referral.updated_at.toISOString(),
          }
        : null,
    };
  }

  async saveEmployeeReferral(
    companyId: string,
    studentId: string,
    evaluationYear: number,
    input: {
      status: string;
      sessions: {
        psychologistId: string;
        datetime: string;
        status: string;
        notes?: string | null;
      }[];
      closure?: {
        psychologistId?: string | null;
        conclusion?: string | null;
        recommendations?: string | null;
        resolution?: string | null;
      } | null;
    },
  ) {
    await assertCompany(companyId);
    await assertEmployee(companyId, studentId);

    const psychologistIds = new Set(
      [
        ...input.sessions.map((session) => session.psychologistId),
        input.closure?.psychologistId ?? null,
      ].filter(Boolean) as string[],
    );
    for (const psychologistId of psychologistIds) {
      const psychologist = await findCompanyPsychologist(companyId, psychologistId);
      if (!psychologist) {
        throw new AppError(400, "Psicólogo inválido para esta empresa", "PSYCHOLOGIST_INVALID");
      }
    }

    const existing = await findEmployeeReferral(companyId, studentId, evaluationYear);
    const closure = input.closure;
    const referral = await upsertEmployeeReferral({
      companyId,
      studentId,
      evaluationYear,
      status: input.status.trim(),
      closurePsychologistId:
        closure === undefined || closure === null
          ? (existing?.closure_psychologist_id ?? null)
          : (closure.psychologistId ?? null),
      conclusion:
        closure === undefined || closure === null
          ? (existing?.conclusion ?? null)
          : normalizeOptional(closure.conclusion),
      recommendations:
        closure === undefined || closure === null
          ? (existing?.recommendations ?? null)
          : normalizeOptional(closure.recommendations),
      resolution:
        closure === undefined || closure === null
          ? (existing?.resolution ?? null)
          : normalizeOptional(closure.resolution),
    });

    const sessions = await replaceReferralSessions(
      referral.id,
      input.sessions.map((session) => ({
        psychologistId: session.psychologistId,
        scheduledAt: session.datetime,
        status: session.status,
        notes: normalizeOptional(session.notes),
      })),
    );

    return {
      referral: {
        id: referral.id,
        status: referral.status,
        evaluationYear: referral.evaluation_year,
        closure: {
          psychologistId: referral.closure_psychologist_id,
          conclusion: referral.conclusion,
          recommendations: referral.recommendations,
          resolution: referral.resolution,
        },
        sessions: sessions.map((session) => ({
          id: session.id,
          psychologistId: session.psychologist_id,
          datetime: session.scheduled_at.toISOString(),
          status: session.status,
          notes: session.notes,
        })),
        updatedAt: referral.updated_at.toISOString(),
      },
    };
  }
}

export const referralService = new ReferralService();
