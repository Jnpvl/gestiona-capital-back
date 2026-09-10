import { AppError } from "../errors/app-error";
import {
  blockBelongsToCourse,
  findActiveEnrollmentBySlug,
  getCourseProgress,
  lessonBelongsToCourse,
  markOnlineEnrollmentCompleted,
  saveCourseProgress,
} from "../repositories/progress.repository";
import { findCourseDetailById } from "../repositories/course.repository";
import type { CourseProgress, SaveCourseProgressInput } from "../types/progress.types";
import {
  findFinalExamBlock,
  findRequiredAssignmentBlocks,
  isLessonAssignmentsApproved,
  isLessonQuizzesPassed,
  isOnlineProgressComplete,
} from "./enrollment-completion";
import { isQuizScorePassing } from "../shared/content/quiz";
import { notifyEnrollmentCompleted } from "./enrollment-notification.service";

export class StudentProgressService {
  async getProgress(studentId: string, slug: string): Promise<CourseProgress> {
    const enrollment = await this.requireEnrollment(studentId, slug);
    return getCourseProgress(enrollment.enrollmentId, enrollment.courseId);
  }

  async saveProgress(
    studentId: string,
    slug: string,
    input: SaveCourseProgressInput,
  ): Promise<CourseProgress> {
    const enrollment = await this.requireEnrollment(studentId, slug);
    const courseDetail = await findCourseDetailById(enrollment.courseId);

    if (input.lastLessonId) {
      const valid = await lessonBelongsToCourse(enrollment.courseId, input.lastLessonId);
      if (!valid) {
        throw new AppError(400, "Clase inválida para este curso", "INVALID_LESSON");
      }
    }

    for (const lesson of input.lessonUpdates ?? []) {
      const valid = await lessonBelongsToCourse(enrollment.courseId, lesson.lessonId);
      if (!valid) {
        throw new AppError(400, "Clase inválida para este curso", "INVALID_LESSON");
      }
    }

    const blockUpdates = (input.blockUpdates ?? []).map((block) => {
      if (!block.passed) return block;
      if (
        typeof block.score === "number" &&
        typeof block.totalQuestions === "number" &&
        !isQuizScorePassing(block.score, block.totalQuestions)
      ) {
        return { ...block, passed: false };
      }
      return block;
    });

    for (const block of blockUpdates) {
      const valid = await blockBelongsToCourse(enrollment.courseId, block.blockId);
      if (!valid) {
        throw new AppError(400, "Bloque inválido para este curso", "INVALID_BLOCK");
      }
    }

    let lessonUpdates = input.lessonUpdates;
    if (lessonUpdates?.length && courseDetail) {
      const currentProgress = await getCourseProgress(
        enrollment.enrollmentId,
        enrollment.courseId,
      );
      lessonUpdates = lessonUpdates.map((lesson) => {
        if (!lesson.completed) return lesson;
        const assignmentsOk = isLessonAssignmentsApproved(
          lesson.lessonId,
          courseDetail.sections,
          currentProgress.assignments,
        );
        const quizzesOk = isLessonQuizzesPassed(
          lesson.lessonId,
          courseDetail.sections,
          currentProgress,
        );
        if (!assignmentsOk || !quizzesOk) {
          return { ...lesson, completed: false };
        }
        return lesson;
      });
    }

    await saveCourseProgress(enrollment.enrollmentId, {
      ...input,
      lessonUpdates,
      blockUpdates,
    });
    const progress = await getCourseProgress(enrollment.enrollmentId, enrollment.courseId);

    if (progress.deliveryMode === "online" && !progress.completedAt && courseDetail) {
      const finalExamInfo = findFinalExamBlock(courseDetail.sections);
      const requiredAssignments = findRequiredAssignmentBlocks(courseDetail.sections);
      if (isOnlineProgressComplete(progress, finalExamInfo, requiredAssignments)) {
        const justCompleted = await markOnlineEnrollmentCompleted(enrollment.enrollmentId);
        if (justCompleted) {
          await notifyEnrollmentCompleted(enrollment.enrollmentId);
        }
        return getCourseProgress(enrollment.enrollmentId, enrollment.courseId);
      }
    }

    return progress;
  }

  private async requireEnrollment(studentId: string, slug: string) {
    const enrollment = await findActiveEnrollmentBySlug(studentId, slug);
    if (!enrollment) {
      throw new AppError(403, "No tienes acceso a este curso", "COURSE_ACCESS_DENIED");
    }
    return enrollment;
  }
}

export const studentProgressService = new StudentProgressService();
