import { AppError } from "../errors/app-error";
import {
  findCourseDetailById,
  findCourseBySlug,
} from "../repositories/course.repository";
import {
  findActiveEnrollmentBySlug,
  getCourseProgress,
  issueCertificateNumber,
  issueDc3CertificateNumber,
  markOnlineEnrollmentCompleted,
} from "../repositories/progress.repository";
import { findStudentById } from "../repositories/student.repository";
import { pool } from "../config/database";
import {
  createCertificateNumber,
  createDc3CertificateNumber,
  generateConstanciaPdf,
  generateDc3Pdf,
} from "./certificate.service";
import {
  FIXED_CONSTANCIA_TEMPLATE_PATH,
} from "../shared/content/certificate-template";
import { buildConstanciaPdfData, formatOnlinePeriod } from "../shared/content/constancia-data";
import { buildDc3PdfData, formatTrainingAgent } from "../shared/content/dc3-data";
import { buildConstanciaDownloadFilename } from "../shared/utils/student-name";
import { findFinalExamBlock, findRequiredAssignmentBlocks, isOnlineProgressComplete } from "./enrollment-completion";
import type { CourseProgress } from "../types/progress.types";

export class StudentCertificateService {
  private async assertEnrollmentCompleted(
    enrollment: {
      enrollmentId: string;
      courseId: string;
      deliveryMode: "online" | "presencial";
      completedAt: string | null;
    },
    progress: CourseProgress,
  ) {
    if (progress.completedAt || enrollment.completedAt) return;

    if (enrollment.deliveryMode === "presencial") {
      throw new AppError(
        403,
        "El curso presencial aún no está marcado como terminado",
        "COURSE_NOT_COMPLETED",
      );
    }

    const courseDetail = await findCourseDetailById(enrollment.courseId);
    const finalExamInfo = courseDetail ? findFinalExamBlock(courseDetail.sections) : null;
    const requiredAssignments = courseDetail
      ? findRequiredAssignmentBlocks(courseDetail.sections)
      : [];
    if (!isOnlineProgressComplete(progress, finalExamInfo, requiredAssignments)) {
      const missingAssignments =
        requiredAssignments.length > 0 &&
        !requiredAssignments.every(
          (block) =>
            (progress.assignments ?? []).find((item) => item.blockId === block.blockId)?.status ===
            "approved",
        );
      throw new AppError(
        403,
        missingAssignments
          ? "Debes tener todas las tareas obligatorias aprobadas para descargar la constancia"
          : finalExamInfo
            ? "Debes aprobar el examen final para descargar la constancia"
            : "Debes completar el curso para descargar la constancia",
        missingAssignments
          ? "ASSIGNMENTS_PENDING"
          : finalExamInfo
            ? "EXAM_NOT_PASSED"
            : "COURSE_NOT_COMPLETED",
      );
    }

    await markOnlineEnrollmentCompleted(enrollment.enrollmentId);
  }

  private async getCertificateContext(studentId: string, slug: string) {
    const enrollment = await findActiveEnrollmentBySlug(studentId, slug);
    if (!enrollment) {
      throw new AppError(404, "Curso no encontrado o sin acceso", "COURSE_NOT_FOUND");
    }

    return this.buildCertificateContext(studentId, slug, enrollment);
  }

  private async getCertificateContextByEnrollment(courseId: string, enrollmentId: string) {
    const { rows } = await pool.query<{
      enrollment_id: string;
      course_id: string;
      student_id: string;
      enrolled_via_company: boolean;
      delivery_mode: "online" | "presencial";
      enrolled_at: Date;
      completed_at: Date | null;
      slug: string;
    }>(
      `SELECT e.id AS enrollment_id,
              e.course_id,
              e.student_id,
              e.enrolled_via_company,
              e.delivery_mode,
              e.enrolled_at,
              e.completed_at,
              c.slug
       FROM enrollments e
       INNER JOIN courses c ON c.id = e.course_id
       WHERE e.id = $1 AND e.course_id = $2 AND e.status = 'active'
       LIMIT 1`,
      [enrollmentId, courseId],
    );

    const row = rows[0];
    if (!row) {
      throw new AppError(404, "Inscripción no encontrada", "ENROLLMENT_NOT_FOUND");
    }

    return this.buildCertificateContext(row.student_id, row.slug, {
      enrollmentId: row.enrollment_id,
      courseId: row.course_id,
      enrolledViaCompany: row.enrolled_via_company,
      deliveryMode: row.delivery_mode,
      enrolledAt: row.enrolled_at.toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null,
    });
  }

  private async buildCertificateContext(
    studentId: string,
    slug: string,
    enrollment: {
      enrollmentId: string;
      courseId: string;
      enrolledViaCompany: boolean;
      deliveryMode: "online" | "presencial";
      enrolledAt: string;
      completedAt: string | null;
    },
  ) {
    const course = await findCourseBySlug(slug);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    const student = await findStudentById(studentId);
    if (!student) {
      throw new AppError(404, "Estudiante no encontrado", "STUDENT_NOT_FOUND");
    }

    const courseDetail = await findCourseDetailById(enrollment.courseId);
    const progress = await getCourseProgress(enrollment.enrollmentId, enrollment.courseId);
    await this.assertEnrollmentCompleted(enrollment, progress);

    const refreshedProgress = await getCourseProgress(
      enrollment.enrollmentId,
      enrollment.courseId,
    );

    return {
      enrollment,
      course,
      student,
      progress: refreshedProgress,
      courseDetail,
      slug,
    };
  }

  async downloadCertificate(studentId: string, slug: string) {
    const context = await this.getCertificateContext(studentId, slug);
    return this.buildConstanciaPdf(context);
  }

  async downloadDc3Certificate(studentId: string, slug: string) {
    const context = await this.getCertificateContext(studentId, slug);
    return this.buildDc3Pdf(context);
  }

  async downloadCertificateForEnrollment(courseId: string, enrollmentId: string) {
    const context = await this.getCertificateContextByEnrollment(courseId, enrollmentId);
    return this.buildConstanciaPdf(context);
  }

  async downloadDc3ForEnrollment(courseId: string, enrollmentId: string) {
    const context = await this.getCertificateContextByEnrollment(courseId, enrollmentId);
    return this.buildDc3Pdf(context);
  }

  private async buildConstanciaPdf(context: Awaited<ReturnType<StudentCertificateService["buildCertificateContext"]>>) {
    const { enrollment, student, progress, courseDetail, slug } = context;

    if (!courseDetail) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    let certificateNumber = progress.certificateNumber;
    if (!certificateNumber) {
      certificateNumber = createCertificateNumber();
      await issueCertificateNumber(enrollment.enrollmentId, certificateNumber);
    }

    const issuedAt = progress.certificateIssuedAt
      ? new Date(progress.certificateIssuedAt)
      : new Date();

    const periodEnd =
      progress.completedAt || enrollment.completedAt || issuedAt.toISOString();
    const hasEnrollmentDates = Boolean(enrollment.enrolledAt && periodEnd);
    const periodOverride = hasEnrollmentDates
      ? formatOnlinePeriod(new Date(enrollment.enrolledAt), new Date(periodEnd))
      : null;

    const pdfBytes = await generateConstanciaPdf(
      FIXED_CONSTANCIA_TEMPLATE_PATH,
      buildConstanciaPdfData({
        studentName: student.name,
        curp: student.curp,
        certificateNumber,
        issuedAt,
        periodOverride,
        course: {
          ...courseDetail,
          modality: enrollment.deliveryMode,
        },
      }),
    );

    const filename = buildConstanciaDownloadFilename({
      courseTitle: courseDetail.title,
      courseSlug: slug,
      paternalLastName: student.paternalLastName,
      maternalLastName: student.maternalLastName,
    });
    return { pdfBytes, filename };
  }

  private async buildDc3Pdf(context: Awaited<ReturnType<StudentCertificateService["buildCertificateContext"]>>) {
    const { enrollment, course, student, progress, courseDetail, slug } = context;

    if (!enrollment.enrolledViaCompany) {
      throw new AppError(
        403,
        "Este curso no fue asignado por empresa",
        "DC3_NOT_AVAILABLE",
      );
    }

    if (!student.companyName?.trim()) {
      throw new AppError(
        400,
        "El estudiante no tiene empresa registrada para generar el DC3",
        "DC3_COMPANY_REQUIRED",
      );
    }

    if (!progress.dc3CertificateNumber) {
      await issueDc3CertificateNumber(enrollment.enrollmentId, createDc3CertificateNumber());
    }

    let verificationFolio = progress.certificateNumber;
    if (!verificationFolio) {
      verificationFolio = createCertificateNumber();
      await issueCertificateNumber(enrollment.enrollmentId, verificationFolio);
    }

    const periodEnd =
      progress.completedAt || enrollment.completedAt || new Date().toISOString();
    const periodStart = enrollment.enrolledAt
      ? new Date(enrollment.enrolledAt)
      : new Date(periodEnd);
    const periodEndDate = new Date(periodEnd);

    const instructorName = courseDetail?.instructor?.name?.trim() || "";
    const pdfBytes = await generateDc3Pdf(
      buildDc3PdfData({
        studentName: student.name,
        curp: student.curp,
        occupationCode: student.stpsOccupationCode,
        occupationName: student.stpsOccupationName,
        position: student.currentPosition,
        companyName: student.companyName,
        companyRfc: student.companyRfc,
        courseTitle: course.title,
        duration: course.duration,
        periodStart,
        periodEnd: periodEndDate,
        thematicAreaCode: courseDetail?.stpsThematicAreaCode ?? student.stpsThematicAreaCode,
        thematicAreaName: courseDetail?.stpsThematicAreaName ?? student.stpsThematicAreaName,
        trainingAgent: formatTrainingAgent(courseDetail?.instructor),
        instructorName,
        instructorSignatureUrl: courseDetail?.instructor?.signatureUrl,
        certificateNumber: verificationFolio,
      }),
    );

    const baseName = buildConstanciaDownloadFilename({
      courseTitle: course.title,
      courseSlug: slug,
      paternalLastName: student.paternalLastName,
      maternalLastName: student.maternalLastName,
    }).replace(/\.pdf$/i, "");
    return { pdfBytes, filename: `dc3-${baseName}.pdf` };
  }
}

export const studentCertificateService = new StudentCertificateService();
