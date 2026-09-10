import { AppError } from "../errors/app-error";
import { findCourseById } from "../repositories/course.repository";
import {
  assignCourseToStudent,
  createStudent,
  findStudentsPaginated,
  findStudentByEmail,
  findStudentById,
  findStudentEnrollments,
  isStudentAccessibleToInstructor,
  markEnrollmentCompleted,
  revokeStudentEnrollment,
  setStudentActive,
  updateStudent,
} from "../repositories/student.repository";
import { notifyEnrollmentCompleted } from "./enrollment-notification.service";
import {
  notifySafely,
  sendCourseAccessEmail,
  sendStudentWelcomeEmail,
} from "./notification.service";
import type {
  CreateStudentInput,
  EnrollmentDeliveryMode,
  ListStudentsFilters,
  UpdateStudentInput,
} from "../types/student.types";
import {
  assertCourseInstructorAccess,
  type StaffScope,
} from "../shared/auth/staff-scope";

export class StudentService {
  private async assertStaffCanAccessStudent(studentId: string, scope: StaffScope) {
    if (scope.isAdmin) return;
    if (!scope.instructorId) {
      throw new AppError(403, "Acceso denegado", "FORBIDDEN");
    }
    const allowed = await isStudentAccessibleToInstructor(studentId, scope.instructorId);
    if (!allowed) {
      throw new AppError(403, "No tienes acceso a este alumno", "STUDENT_ACCESS_DENIED");
    }
  }

  async list(filters: ListStudentsFilters = {}, scope?: StaffScope) {
    return findStudentsPaginated({
      ...filters,
      instructorId: scope?.instructorId ?? filters.instructorId,
    });
  }

  async getById(id: string, scope: StaffScope) {
    await this.assertStaffCanAccessStudent(id, scope);
    const student = await findStudentById(id);
    if (!student) {
      throw new AppError(404, "Estudiante no encontrado", "STUDENT_NOT_FOUND");
    }

    const enrollments = await findStudentEnrollments(id, {
      instructorId: scope.instructorId ?? undefined,
    });

    return { student, enrollments };
  }

  async create(input: CreateStudentInput, scope: StaffScope) {
    const existing = await findStudentByEmail(input.email);
    if (existing) {
      throw new AppError(409, "Ya existe un estudiante con ese correo", "EMAIL_EXISTS");
    }

    try {
      const student = await createStudent({
        ...input,
        createdByStaffId: input.createdByStaffId ?? scope.staffId,
      });
      await notifySafely(() =>
        sendStudentWelcomeEmail({
          name: student.name,
          email: student.email,
          password: input.password,
        }),
      );
      return { student };
    } catch (error) {
      if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
        throw new AppError(404, "La empresa seleccionada no existe", "COMPANY_NOT_FOUND");
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateStudentInput, scope: StaffScope) {
    await this.assertStaffCanAccessStudent(id, scope);
    const current = await findStudentById(id);
    if (!current) {
      throw new AppError(404, "Estudiante no encontrado", "STUDENT_NOT_FOUND");
    }

    if (input.email && input.email.toLowerCase() !== current.email) {
      const existing = await findStudentByEmail(input.email);
      if (existing) {
        throw new AppError(409, "Ya existe un estudiante con ese correo", "EMAIL_EXISTS");
      }
    }

    try {
      const { sendAccessEmail, ...data } = input;
      const student = await updateStudent(id, data);
      if (!student) {
        throw new AppError(404, "Estudiante no encontrado", "STUDENT_NOT_FOUND");
      }

      if (sendAccessEmail && data.password) {
        await notifySafely(() =>
          sendStudentWelcomeEmail({
            name: student.name,
            email: student.email,
            password: data.password!,
          }),
        );
      }

      return { student };
    } catch (error) {
      if (error instanceof Error && error.message === "COMPANY_NOT_FOUND") {
        throw new AppError(404, "La empresa seleccionada no existe", "COMPANY_NOT_FOUND");
      }
      throw error;
    }
  }

  async sendAccess(id: string, password: string, scope: StaffScope) {
    await this.assertStaffCanAccessStudent(id, scope);
    const current = await findStudentById(id);
    if (!current) {
      throw new AppError(404, "Estudiante no encontrado", "STUDENT_NOT_FOUND");
    }

    const student = await updateStudent(id, { password });
    if (!student) {
      throw new AppError(404, "Estudiante no encontrado", "STUDENT_NOT_FOUND");
    }

    await notifySafely(() =>
      sendStudentWelcomeEmail({
        name: student.name,
        email: student.email,
        password,
      }),
    );

    return { student, emailed: true as const };
  }

  async updateStatus(id: string, active: boolean, scope: StaffScope) {
    await this.assertStaffCanAccessStudent(id, scope);
    const student = await setStudentActive(id, active);
    if (!student) {
      throw new AppError(404, "Estudiante no encontrado", "STUDENT_NOT_FOUND");
    }
    return { student };
  }

  async assignCourse(
    studentId: string,
    courseId: string,
    enrolledViaCompany = false,
    deliveryMode: EnrollmentDeliveryMode = "online",
    scope: StaffScope,
  ) {
    await this.assertStaffCanAccessStudent(studentId, scope);

    const course = await findCourseById(courseId);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }
    assertCourseInstructorAccess(course.instructor_id, scope);

    const student = await findStudentById(studentId);
    if (!student) {
      throw new AppError(404, "Estudiante no encontrado", "STUDENT_NOT_FOUND");
    }

    if (enrolledViaCompany) {
      if (!student.companyName?.trim()) {
        throw new AppError(
          400,
          "El estudiante debe tener empresa registrada para inscripción con DC3",
          "COMPANY_REQUIRED",
        );
      }
      if (!student.companyRfc?.trim()) {
        throw new AppError(
          400,
          "El estudiante debe tener RFC de empresa registrado",
          "COMPANY_RFC_REQUIRED",
        );
      }
      if (!student.curp?.trim()) {
        throw new AppError(400, "El estudiante debe tener CURP registrada", "CURP_REQUIRED");
      }
      if (!student.stpsOccupationCode) {
        throw new AppError(
          400,
          "El estudiante debe tener puesto del catálogo STPS",
          "STPS_OCCUPATION_REQUIRED",
        );
      }
    }

    try {
      const enrollment = await assignCourseToStudent(
        studentId,
        courseId,
        enrolledViaCompany,
        deliveryMode,
      );
      await notifySafely(() =>
        sendCourseAccessEmail({
          name: student.name,
          email: student.email,
          courseTitle: enrollment.courseTitle,
          courseSlug: enrollment.courseSlug,
        }),
      );
      return { enrollment };
    } catch (error) {
      if (!(error instanceof Error)) throw error;

      switch (error.message) {
        case "COURSE_NOT_FOUND":
          throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
        case "COURSE_NOT_PUBLISHED":
          throw new AppError(
            400,
            "Solo puedes asignar cursos publicados",
            "COURSE_NOT_PUBLISHED",
          );
        case "ENROLLMENT_EXISTS":
          throw new AppError(
            409,
            "El estudiante ya tiene asignado este curso",
            "ENROLLMENT_EXISTS",
          );
        default:
          throw new AppError(500, "No se pudo asignar el curso", "ENROLLMENT_CREATE_FAILED");
      }
    }
  }

  async revokeEnrollment(studentId: string, enrollmentId: string, scope: StaffScope) {
    await this.assertStaffCanAccessStudent(studentId, scope);

    const enrollments = await findStudentEnrollments(studentId);
    const target = enrollments.find((item) => item.id === enrollmentId);
    if (!target) {
      throw new AppError(
        404,
        "Inscripción no encontrada o ya fue retirada",
        "ENROLLMENT_NOT_FOUND",
      );
    }

    const course = await findCourseById(target.courseId);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }
    assertCourseInstructorAccess(course.instructor_id, scope);

    try {
      const enrollment = await revokeStudentEnrollment(studentId, enrollmentId);
      return { enrollment };
    } catch (error) {
      if (error instanceof Error && error.message === "ENROLLMENT_NOT_FOUND") {
        throw new AppError(
          404,
          "Inscripción no encontrada o ya fue retirada",
          "ENROLLMENT_NOT_FOUND",
        );
      }
      throw new AppError(500, "No se pudo quitar el curso", "ENROLLMENT_REVOKE_FAILED");
    }
  }

  async markEnrollmentCompleted(studentId: string, enrollmentId: string, scope: StaffScope) {
    await this.assertStaffCanAccessStudent(studentId, scope);

    const enrollments = await findStudentEnrollments(studentId);
    const target = enrollments.find((item) => item.id === enrollmentId);
    if (!target) {
      throw new AppError(404, "Inscripción no encontrada", "ENROLLMENT_NOT_FOUND");
    }

    const course = await findCourseById(target.courseId);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }
    assertCourseInstructorAccess(course.instructor_id, scope);

    try {
      const updated = await markEnrollmentCompleted(enrollmentId, { studentId });
      const nextEnrollments = await findStudentEnrollments(studentId, {
        instructorId: scope.instructorId ?? undefined,
      });
      const enrollment = nextEnrollments.find((item) => item.id === enrollmentId);
      if (!enrollment) {
        throw new AppError(404, "Inscripción no encontrada", "ENROLLMENT_NOT_FOUND");
      }
      if (updated.justCompleted) {
        await notifyEnrollmentCompleted(enrollmentId);
      }
      return { enrollment };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.message === "ENROLLMENT_NOT_FOUND") {
        throw new AppError(404, "Inscripción no encontrada", "ENROLLMENT_NOT_FOUND");
      }
      throw new AppError(500, "No se pudo marcar como terminado", "ENROLLMENT_COMPLETE_FAILED");
    }
  }
}

export const studentService = new StudentService();
