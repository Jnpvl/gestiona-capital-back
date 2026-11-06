import { AppError } from "../errors/app-error";
import {
  createCompany,
  findCompaniesPaginated,
  findCompanyActiveEmployeesForCourses,
  findCompanyById,
  findCompanyByNormalizedName,
  findCompanyByAccessEmail,
  findCompanyCourseSummaries,
  normalizeCompanyName,
  setCompanyAccess,
  updateCompany,
} from "../repositories/company.repository";
import { findCourseById } from "../repositories/course.repository";
import { findStaffByEmail } from "../repositories/staff.repository";
import {
  assignCourseToStudent,
  findCourseEnrollments,
  findStudentByEmail,
} from "../repositories/student.repository";
import type { EnrollmentDeliveryMode } from "../types/student.types";
import { notifySafely, sendCompanyWelcomeEmail, sendCourseAccessEmail } from "./notification.service";
import type {
  CompanyAccessInput,
  CreateCompanyInput,
  ListCompaniesFilters,
  UpdateCompanyInput,
} from "../types/company.types";

export class CompanyService {
  async list(filters: ListCompaniesFilters = {}) {
    return findCompaniesPaginated(filters);
  }

  async listForAutocomplete(search?: string) {
    const { companies } = await findCompaniesPaginated({
      search,
      page: 1,
      limit: 50,
    });
    return { companies };
  }

  async getById(id: string) {
    const company = await findCompanyById(id);
    if (!company) {
      throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    }
    return { company };
  }

  async create(input: CreateCompanyInput) {
    const normalized = normalizeCompanyName(input.name);
    const existing = await findCompanyByNormalizedName(normalized);
    if (existing) {
      throw new AppError(409, "Ya existe una empresa con ese nombre", "COMPANY_EXISTS");
    }

    if (input.accessEmail) await this.assertAccessEmailFree(input.accessEmail, null);
    const { accessEmail, password, sendAccessEmail, ...profile } = input;
    let company = await createCompany(profile);
    if (accessEmail && password) {
      company = (await this.saveAccess(company.id, { accessEmail, password, sendAccessEmail })).company;
    }
    return { company };
  }

  /** El correo de acceso no puede estar en uso por otra empresa, un alumno o el personal. */
  private async assertAccessEmailFree(email: string, companyId: string | null) {
    const conflict = (message: string) =>
      new AppError(409, `Correo de acceso: ${message}`, "ACCESS_EMAIL_EXISTS", [
        { field: "accessEmail", label: "Correo de acceso", message },
      ]);
    const other = await findCompanyByAccessEmail(email);
    if (other && other.id !== companyId) throw conflict(`ya lo usa la empresa ${other.name}`);
    if (await findStudentByEmail(email)) throw conflict("ya lo usa un alumno");
    if (await findStaffByEmail(email)) throw conflict("ya lo usa un usuario del panel");
  }

  private async saveAccess(id: string, input: CompanyAccessInput) {
    await setCompanyAccess(id, { accessEmail: input.accessEmail, password: input.password ?? null });
    const company = await findCompanyById(id);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    if (input.sendAccessEmail && input.password) {
      await notifySafely(() =>
        sendCompanyWelcomeEmail({ name: company.name, email: input.accessEmail, password: input.password! }),
      );
    }
    return { company };
  }

  /** Alta o cambio del acceso de una empresa existente (correo y, opcional, contraseña nueva). */
  async updateAccess(id: string, input: CompanyAccessInput) {
    const current = await findCompanyById(id);
    if (!current) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    if (!current.hasAccess && !input.password) {
      throw new AppError(400, "Contraseña: es obligatoria para dar acceso a la empresa", "VALIDATION_ERROR", [
        { field: "password", label: "Contraseña", message: "es obligatoria para dar acceso a la empresa" },
      ]);
    }
    await this.assertAccessEmailFree(input.accessEmail, id);
    return this.saveAccess(id, input);
  }

  async update(id: string, input: UpdateCompanyInput) {
    const current = await findCompanyById(id);
    if (!current) {
      throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    }

    if (input.name && normalizeCompanyName(input.name) !== normalizeCompanyName(current.name)) {
      const existing = await findCompanyByNormalizedName(normalizeCompanyName(input.name));
      if (existing && existing.id !== id) {
        throw new AppError(409, "Ya existe una empresa con ese nombre", "COMPANY_EXISTS");
      }
    }

    const company = await updateCompany(id, input);
    if (!company) {
      throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    }

    return { company };
  }

  /** Cursos con inscripciones activas «con empresa» de esta empresa. */
  async listCourses(companyId: string) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const courses = await findCompanyCourseSummaries(companyId);
    return { companyId, courses };
  }

  /** Detalle de un curso en la empresa: inscritos con empresa y empleados que faltan. */
  async getCourseDetail(companyId: string, courseId: string) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");

    const course = await findCourseById(courseId);
    if (!course) throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");

    const [enrollments, employees, summaries] = await Promise.all([
      findCourseEnrollments(courseId, { companyId, viaCompanyOnly: true }),
      findCompanyActiveEmployeesForCourses(companyId),
      findCompanyCourseSummaries(companyId),
    ]);
    const summary = summaries.find((item) => item.courseId === courseId);
    if (!summary && enrollments.length === 0) {
      throw new AppError(
        404,
        "Este curso no tiene asignaciones con empresa en esta empresa",
        "COMPANY_COURSE_NOT_FOUND",
      );
    }

    const enrolledIds = new Set(enrollments.map((item) => item.studentId));
    const missing = employees
      .filter((employee) => !enrolledIds.has(employee.id))
      .map((employee) => ({
        studentId: employee.id,
        name: employee.name,
        email: employee.email,
        reason: !employee.curp?.trim()
          ? "Sin CURP"
          : !employee.stpsOccupationCode
            ? "Sin puesto STPS"
            : "Sin asignar",
      }));

    return {
      companyId,
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        activeCount: summary?.activeCount ?? enrollments.length,
        completedCount:
          summary?.completedCount ?? enrollments.filter((item) => item.completed).length,
        employeesTotal: summary?.employeesTotal ?? employees.length,
        deliveryModes: summary?.deliveryModes ?? [
          ...new Set(enrollments.map((item) => item.deliveryMode)),
        ],
      },
      enrollments,
      missing,
    };
  }

  /**
   * Asigna un curso publicado a todos los empleados activos, siempre con empresa.
   * Omite a quien ya lo tenga o le falten CURP / puesto STPS.
   */
  async assignCourse(
    companyId: string,
    courseId: string,
    deliveryMode: EnrollmentDeliveryMode = "online",
  ) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    if (!company.rfc?.trim()) {
      throw new AppError(
        400,
        "Registra el RFC de la empresa antes de asignar cursos con DC3",
        "COMPANY_RFC_REQUIRED",
      );
    }

    const course = await findCourseById(courseId);
    if (!course) throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    if (course.status !== "published") {
      throw new AppError(400, "Solo puedes asignar cursos publicados", "COURSE_NOT_PUBLISHED");
    }

    const employees = await findCompanyActiveEmployeesForCourses(companyId);
    if (employees.length === 0) {
      throw new AppError(
        400,
        "La empresa no tiene empleados activos para asignar el curso",
        "NO_EMPLOYEES",
      );
    }

    const results: {
      studentId: string;
      name: string;
      email: string;
      status: "assigned" | "upgraded" | "skipped" | "failed";
      reason?: string;
    }[] = [];

    for (const employee of employees) {
      if (!employee.curp?.trim()) {
        results.push({
          studentId: employee.id,
          name: employee.name,
          email: employee.email,
          status: "skipped",
          reason: "Falta CURP",
        });
        continue;
      }
      if (!employee.stpsOccupationCode) {
        results.push({
          studentId: employee.id,
          name: employee.name,
          email: employee.email,
          status: "skipped",
          reason: "Falta puesto STPS",
        });
        continue;
      }

      try {
        const { enrollment, outcome } = await assignCourseToStudent(
          employee.id,
          courseId,
          true,
          deliveryMode,
        );
        if (outcome !== "upgraded_to_company") {
          await notifySafely(() =>
            sendCourseAccessEmail({
              name: employee.name,
              email: employee.email,
              courseTitle: enrollment.courseTitle,
              courseSlug: enrollment.courseSlug,
            }),
          );
        }
        results.push({
          studentId: employee.id,
          name: employee.name,
          email: employee.email,
          status: outcome === "upgraded_to_company" ? "upgraded" : "assigned",
          reason:
            outcome === "upgraded_to_company"
              ? "Era particular; ahora es con empresa (se conservó el progreso)"
              : undefined,
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : "UNKNOWN";
        if (code === "ENROLLMENT_EXISTS") {
          results.push({
            studentId: employee.id,
            name: employee.name,
            email: employee.email,
            status: "skipped",
            reason: "Ya tiene este curso con empresa",
          });
          continue;
        }
        results.push({
          studentId: employee.id,
          name: employee.name,
          email: employee.email,
          status: "failed",
          reason: code === "COURSE_NOT_PUBLISHED" ? "Curso no publicado" : "No se pudo asignar",
        });
      }
    }

    return {
      courseId,
      courseTitle: course.title,
      deliveryMode,
      enrolledViaCompany: true as const,
      total: results.length,
      assigned: results.filter((r) => r.status === "assigned").length,
      upgraded: results.filter((r) => r.status === "upgraded").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
      courses: await findCompanyCourseSummaries(companyId),
    };
  }
}

export const companyService = new CompanyService();
