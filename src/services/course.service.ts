import { AppError } from "../errors/app-error";
import {
  createCourse,
  findCourseById,
  findCourseBySlugPublic,
  findCourseDetailById,
  findCoursesPaginated,
  findFeaturedCourses,
  findPublishedCatalog,
  replaceCourseContent,
  updateCoursePromotion,
} from "../repositories/course.repository";
import {
  findActiveEnrolledStudents,
  findCourseEnrollments,
  markEnrollmentCompleted,
} from "../repositories/student.repository";
import { notifyEnrollmentCompleted } from "./enrollment-notification.service";
import {
  notifySafely,
  sendNewCourseAvailableEmail,
} from "./notification.service";
import type {
  CreateCourseInput,
  SectionInput,
  ListCoursesFilters,
  UpdateCoursePromotionInput,
} from "../types/course.types";
import { generateConstanciaPdf, generateDc3Pdf } from "./certificate.service";
import { FIXED_CONSTANCIA_TEMPLATE_PATH } from "../shared/content/certificate-template";
import { buildConstanciaPreviewData } from "../shared/content/constancia-data";
import { buildDc3PreviewData } from "../shared/content/dc3-data";
import {
  assertCourseInstructorAccess,
  type StaffScope,
} from "../shared/auth/staff-scope";

export class CourseService {
  async assertStaffCanAccessCourse(courseId: string, scope: StaffScope) {
    const course = await findCourseById(courseId);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }
    assertCourseInstructorAccess(course.instructor_id, scope);
    return course;
  }

  async listAdmin(filters: ListCoursesFilters = {}, scope?: StaffScope) {
    return findCoursesPaginated({
      ...filters,
      instructorId: scope?.instructorId ?? filters.instructorId,
    });
  }

  async getAdminById(id: string, scope: StaffScope) {
    await this.assertStaffCanAccessCourse(id, scope);
    const course = await findCourseDetailById(id);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }
    return { course };
  }

  async create(input: CreateCourseInput) {
    const course = await createCourse(input);
    return { course };
  }

  async updatePromotion(id: string, input: UpdateCoursePromotionInput, scope: StaffScope) {
    await this.assertStaffCanAccessCourse(id, scope);
    const current = await findCourseById(id);
    if (!current) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    const course = await updateCoursePromotion(id, input);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    if (current.status !== "published" && course.status === "published") {
      void notifySafely(async () => {
        const students = await findActiveEnrolledStudents(course.id);
        for (const student of students) {
          await sendNewCourseAvailableEmail({
            name: student.name,
            email: student.email,
            courseTitle: course.title,
            courseSlug: course.slug,
          });
        }
      });
    }

    return { course };
  }

  async updateContent(id: string, sections: SectionInput[], scope: StaffScope) {
    await this.assertStaffCanAccessCourse(id, scope);
    const current = await findCourseById(id);
    if (!current) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    const finalExamSections = sections.filter((section) => section.isFinalExam);
    if (finalExamSections.length > 1) {
      throw new AppError(
        400,
        "Solo puede haber un examen final por curso",
        "MULTIPLE_FINAL_EXAMS",
      );
    }

    const course = await replaceCourseContent(id, sections);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    return { course };
  }

  async previewCertificate(id: string, scope: StaffScope, _templateUrl?: string) {
    await this.assertStaffCanAccessCourse(id, scope);
    const course = await findCourseDetailById(id);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    const pdfBytes = await generateConstanciaPdf(
      FIXED_CONSTANCIA_TEMPLATE_PATH,
      buildConstanciaPreviewData(course.instructor),
    );

    return { pdfBytes, filename: `vista-previa-constancia-${course.slug}.pdf` };
  }

  async previewDc3Certificate(id: string, scope: StaffScope, _templateUrl?: string) {
    await this.assertStaffCanAccessCourse(id, scope);
    const course = await findCourseDetailById(id);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    const pdfBytes = await generateDc3Pdf(
      buildDc3PreviewData({
        courseTitle: course.title,
        duration: course.duration,
        instructorName: course.instructor?.name,
        instructorAceStps: course.instructor?.aceStpsRegistration,
        instructorSignatureUrl: course.instructor?.signatureUrl,
        thematicAreaCode: course.stpsThematicAreaCode,
        thematicAreaName: course.stpsThematicAreaName,
      }),
    );

    return { pdfBytes, filename: `vista-previa-dc3-${course.slug}.pdf` };
  }

  async listEnrollments(courseId: string, scope: StaffScope) {
    await this.assertStaffCanAccessCourse(courseId, scope);
    const enrollments = await findCourseEnrollments(courseId);
    return { enrollments };
  }

  async markEnrollmentCompleted(courseId: string, enrollmentId: string, scope: StaffScope) {
    await this.assertStaffCanAccessCourse(courseId, scope);

    try {
      const updated = await markEnrollmentCompleted(enrollmentId, { courseId });
      const enrollments = await findCourseEnrollments(courseId);
      const enrollment = enrollments.find((item) => item.id === enrollmentId);
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

  async listPublic() {
    const courses = await findPublishedCatalog();
    return { courses };
  }

  async listFeatured(limit = 3) {
    const courses = await findFeaturedCourses(limit);
    return { courses };
  }

  async getPublicBySlug(slug: string) {
    const course = await findCourseBySlugPublic(slug);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }
    return { course };
  }
}

export const courseService = new CourseService();
