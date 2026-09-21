import { AppError } from "../errors/app-error";
import { deleteCourseUploadTrees, deleteManagedUploadsSafe } from "./upload.service";
import {
  createCourse,
  deleteCourseById,
  findCourseById,
  findCourseBySlugPublic,
  findCourseDetailById,
  findCoursesPaginated,
  findFeaturedCourses,
  findPublishedCatalog,
  listCourseBlockResourceUrls,
  replaceCourseContent,
  updateCoursePromotion,
} from "../repositories/course.repository";
import {
  listAssignmentBlockIdsForCourse,
  listSubmissionFileUrlsByBlockIds,
} from "../repositories/assignment.repository";
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
import { findStaffById } from "../repositories/staff.repository";

async function assertAssignableInstructor(instructorId: string | null | undefined) {
  if (!instructorId) return;

  const staff = await findStaffById(instructorId);
  if (!staff || !staff.active) {
    throw new AppError(
      400,
      "El instructor seleccionado no existe o está inactivo",
      "INVALID_INSTRUCTOR",
    );
  }
  if (staff.role !== "teacher" && staff.role !== "admin") {
    throw new AppError(
      400,
      "Solo puedes asignar el curso a un instructor o administrador activo",
      "INVALID_INSTRUCTOR_ROLE",
    );
  }
}

function collectResourceUrlsFromSections(sections: SectionInput[]): Set<string> {
  const urls = new Set<string>();
  for (const section of sections) {
    for (const lesson of section.lessons) {
      for (const block of lesson.blocks) {
        const url = block.resourceUrl?.trim();
        if (url) urls.add(url);
      }
    }
  }
  return urls;
}

function collectAssignmentBlockIdsFromSections(sections: SectionInput[]): Set<string> {
  const ids = new Set<string>();
  for (const section of sections) {
    for (const lesson of section.lessons) {
      for (const block of lesson.blocks) {
        if (block.type === "assignment" && block.id) ids.add(block.id);
      }
    }
  }
  return ids;
}

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
      // Teachers are scoped to their own courses; admins may filter freely.
      instructorId: scope?.instructorId ?? filters.instructorId,
      unassigned: scope?.instructorId ? undefined : filters.unassigned,
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

  async create(input: CreateCourseInput, scope: StaffScope) {
    let instructorId: string | null;

    if (scope.isAdmin) {
      instructorId = input.instructorId ?? null;
      await assertAssignableInstructor(instructorId);
    } else {
      // Teachers always own the courses they create.
      instructorId = scope.staffId;
    }

    const course = await createCourse({
      ...input,
      instructorId,
    });
    return { course };
  }

  async updatePromotion(id: string, input: UpdateCoursePromotionInput, scope: StaffScope) {
    await this.assertStaffCanAccessCourse(id, scope);
    const current = await findCourseById(id);
    if (!current) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    const promotionInput: UpdateCoursePromotionInput = { ...input };
    if (scope.isAdmin) {
      if (promotionInput.instructorId !== undefined) {
        await assertAssignableInstructor(promotionInput.instructorId);
      }
    } else {
      // Teachers cannot reassign course ownership.
      delete promotionInput.instructorId;
    }

    const course = await updateCoursePromotion(id, promotionInput);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    if (
      input.coverImage !== undefined &&
      current.cover_image &&
      current.cover_image !== course.coverImage
    ) {
      await deleteManagedUploadsSafe([current.cover_image]);
    }

    if (
      input.certificateTemplateUrl !== undefined &&
      current.certificate_template_url &&
      current.certificate_template_url !== course.certificateTemplateUrl
    ) {
      await deleteManagedUploadsSafe([current.certificate_template_url]);
    }

    if (
      input.dc3TemplateUrl !== undefined &&
      current.dc3_template_url &&
      current.dc3_template_url !== course.dc3TemplateUrl
    ) {
      await deleteManagedUploadsSafe([current.dc3_template_url]);
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

    const previousUrls = await listCourseBlockResourceUrls(id);
    const previousAssignmentBlockIds = await listAssignmentBlockIdsForCourse(id);
    const nextAssignmentBlockIds = collectAssignmentBlockIdsFromSections(sections);
    const removedAssignmentBlockIds = previousAssignmentBlockIds.filter(
      (blockId) => !nextAssignmentBlockIds.has(blockId),
    );
    const submissionUrlsToDelete =
      await listSubmissionFileUrlsByBlockIds(removedAssignmentBlockIds);

    const course = await replaceCourseContent(id, sections);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    const nextUrls = collectResourceUrlsFromSections(sections);
    const removedBlockUrls = previousUrls.filter((url) => !nextUrls.has(url));
    await deleteManagedUploadsSafe([...removedBlockUrls, ...submissionUrlsToDelete]);

    return { course };
  }

  async delete(id: string, scope: StaffScope) {
    await this.assertStaffCanAccessCourse(id, scope);
    const current = await findCourseById(id);
    if (!current) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    const blockUrls = await listCourseBlockResourceUrls(id);
    const assignmentBlockIds = await listAssignmentBlockIdsForCourse(id);
    const submissionUrls = await listSubmissionFileUrlsByBlockIds(assignmentBlockIds);

    const deleted = await deleteCourseById(id);
    if (!deleted) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    await deleteManagedUploadsSafe([
      current.cover_image,
      current.certificate_template_url,
      current.dc3_template_url,
      ...blockUrls,
      ...submissionUrls,
    ]);
    await deleteCourseUploadTrees(current.slug);

    return { ok: true as const, id };
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
