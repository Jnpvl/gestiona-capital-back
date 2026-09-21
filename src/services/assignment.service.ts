import { AppError } from "../errors/app-error";
import {
  createAssignmentSubmission,
  findSubmissionForCourse,
  getAssignmentBlockMeta,
  getLatestSubmission,
  listCourseAssignmentSubmissions,
  reviewAssignmentSubmission,
} from "../repositories/assignment.repository";
import { findCourseById, findCourseDetailById } from "../repositories/course.repository";
import {
  findActiveEnrollmentBySlug,
  getCourseProgress,
  markOnlineEnrollmentCompleted,
  saveCourseProgress,
} from "../repositories/progress.repository";
import { isAssignmentBlockRequired } from "../shared/content/assignment";
import { saveAssignmentSubmissionFile } from "./upload.service";
import { notifyEnrollmentCompleted } from "./enrollment-notification.service";
import {
  notifySafely,
  sendAssignmentReviewedEmail,
} from "./notification.service";
import {
  findFinalExamBlock,
  findRequiredAssignmentBlocks,
  isOnlineProgressComplete,
} from "./enrollment-completion";
import type { AssignmentSubmissionStatus } from "../types/assignment.types";
import type { CourseProgress } from "../types/progress.types";
import type { StaffScope } from "../shared/auth/staff-scope";
import { courseService } from "./course.service";

export class AssignmentService {
  async submit(
    studentId: string,
    slug: string,
    blockId: string,
    file: Express.Multer.File,
    studentComment?: string | null,
  ): Promise<CourseProgress> {
    const enrollment = await findActiveEnrollmentBySlug(studentId, slug);
    if (!enrollment) {
      throw new AppError(403, "No tienes acceso a este curso", "COURSE_ACCESS_DENIED");
    }

    const course = await findCourseById(enrollment.courseId);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    const block = await getAssignmentBlockMeta(enrollment.courseId, blockId);
    if (!block || block.type !== "assignment") {
      throw new AppError(400, "Bloque de tarea inválido", "INVALID_ASSIGNMENT_BLOCK");
    }

    const latest = await getLatestSubmission(enrollment.enrollmentId, blockId);
    if (latest.status === "pending") {
      throw new AppError(
        400,
        "Ya tienes una entrega en revisión. Espera la respuesta del instructor.",
        "SUBMISSION_PENDING",
      );
    }
    if (latest.status === "approved") {
      throw new AppError(400, "Esta tarea ya fue aprobada", "SUBMISSION_APPROVED");
    }

    const saved = await saveAssignmentSubmissionFile({
      courseSlug: course.slug,
      studentId,
      blockId,
      file,
      // Keep previous attempt files on disk for history; they are purged when
      // the assignment block (or course content) is removed.
    });

    await createAssignmentSubmission({
      enrollmentId: enrollment.enrollmentId,
      blockId,
      fileUrl: saved.path,
      fileName: saved.fileName,
      studentComment: studentComment?.trim() || null,
    });

    return getCourseProgress(enrollment.enrollmentId, enrollment.courseId);
  }

  async listForCourse(
    courseId: string,
    status: AssignmentSubmissionStatus | "all" | undefined,
    scope: StaffScope,
  ) {
    await courseService.assertStaffCanAccessCourse(courseId, scope);

    const submissions = await listCourseAssignmentSubmissions(courseId, status ?? "all");
    return { submissions };
  }

  async review(
    courseId: string,
    submissionId: string,
    staffId: string,
    input: { status: "approved" | "returned"; reviewerComment?: string | null },
    scope: StaffScope,
  ): Promise<{ progress: CourseProgress | null }> {
    await courseService.assertStaffCanAccessCourse(courseId, scope);
    const submission = await findSubmissionForCourse(courseId, submissionId);
    if (!submission) {
      throw new AppError(404, "Entrega no encontrada", "SUBMISSION_NOT_FOUND");
    }

    if (submission.status !== "pending") {
      throw new AppError(400, "Esta entrega ya fue revisada", "SUBMISSION_ALREADY_REVIEWED");
    }

    if (input.status === "returned" && !input.reviewerComment?.trim()) {
      throw new AppError(
        400,
        "Al devolver una tarea debes dejar una observación",
        "REVIEWER_COMMENT_REQUIRED",
      );
    }

    await reviewAssignmentSubmission({
      submissionId,
      status: input.status,
      reviewerComment: input.reviewerComment?.trim() || null,
      reviewedBy: staffId,
    });

    await notifySafely(() =>
      sendAssignmentReviewedEmail({
        name: submission.studentName,
        email: submission.studentEmail,
        courseTitle: submission.courseTitle,
        courseSlug: submission.courseSlug,
        assignmentTitle: submission.assignmentTitle,
        approved: input.status === "approved",
        reviewerComment: input.reviewerComment,
      }),
    );

    if (input.status === "approved") {
      await saveCourseProgress(submission.enrollmentId, {
        lessonUpdates: [{ lessonId: submission.lessonId, completed: true, accessed: true }],
      });

      const progress = await getCourseProgress(submission.enrollmentId, courseId);
      const courseDetail = await findCourseDetailById(courseId);
      if (
        progress.deliveryMode === "online" &&
        !progress.completedAt &&
        courseDetail
      ) {
        const finalExamInfo = findFinalExamBlock(courseDetail.sections);
        const requiredAssignments = findRequiredAssignmentBlocks(courseDetail.sections);
        if (isOnlineProgressComplete(progress, finalExamInfo, requiredAssignments)) {
          const justCompleted = await markOnlineEnrollmentCompleted(submission.enrollmentId);
          if (justCompleted) {
            await notifyEnrollmentCompleted(submission.enrollmentId);
          }
          return {
            progress: await getCourseProgress(submission.enrollmentId, courseId),
          };
        }
      }

      return { progress };
    }

    return { progress: await getCourseProgress(submission.enrollmentId, courseId) };
  }

  isBlockRequired(content: string | null | undefined): boolean {
    return isAssignmentBlockRequired(content);
  }
}

export const assignmentService = new AssignmentService();
