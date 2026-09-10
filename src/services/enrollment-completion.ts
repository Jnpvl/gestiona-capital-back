import type { CourseSection } from "../types/course.types";
import type { AssignmentProgressItem } from "../types/assignment.types";
import type { CourseProgress } from "../types/progress.types";
import { isAssignmentBlockRequired } from "../shared/content/assignment";

export interface FinalExamBlockInfo {
  blockId: string;
}

export interface RequiredAssignmentBlockInfo {
  blockId: string;
  lessonId: string;
}

export function findFinalExamBlock(sections: CourseSection[]): FinalExamBlockInfo | null {
  for (const section of sections) {
    if (!section.isFinalExam) continue;

    const lesson = section.lessons[0];
    const block = lesson?.blocks.find((item) => item.type === "quiz") ?? lesson?.blocks[0];
    if (!block) return null;

    return { blockId: block.id };
  }

  return null;
}

export function findRequiredAssignmentBlocks(
  sections: CourseSection[],
): RequiredAssignmentBlockInfo[] {
  const blocks: RequiredAssignmentBlockInfo[] = [];

  for (const section of sections) {
    for (const lesson of section.lessons) {
      for (const block of lesson.blocks) {
        if (block.type !== "assignment") continue;
        if (!isAssignmentBlockRequired(block.content)) continue;
        blocks.push({ blockId: block.id, lessonId: lesson.id });
      }
    }
  }

  return blocks;
}

export function areRequiredAssignmentsApproved(
  assignments: AssignmentProgressItem[] | undefined,
  requiredBlocks: RequiredAssignmentBlockInfo[],
): boolean {
  if (requiredBlocks.length === 0) return true;

  const byBlock = new Map((assignments ?? []).map((item) => [item.blockId, item]));
  return requiredBlocks.every((block) => byBlock.get(block.blockId)?.status === "approved");
}

export function isLessonAssignmentsApproved(
  lessonId: string,
  sections: CourseSection[],
  assignments: AssignmentProgressItem[] | undefined,
): boolean {
  const required = findRequiredAssignmentBlocks(sections).filter(
    (block) => block.lessonId === lessonId,
  );
  return areRequiredAssignmentsApproved(assignments, required);
}

export function findPracticeQuizBlocks(
  sections: CourseSection[],
): Array<{ blockId: string; lessonId: string }> {
  const blocks: Array<{ blockId: string; lessonId: string }> = [];

  for (const section of sections) {
    if (section.isFinalExam) continue;
    for (const lesson of section.lessons) {
      for (const block of lesson.blocks) {
        if (block.type === "quiz") {
          blocks.push({ blockId: block.id, lessonId: lesson.id });
        }
      }
    }
  }

  return blocks;
}

export function arePracticeQuizzesPassed(
  progress: CourseProgress,
  sections: CourseSection[],
): boolean {
  const quizzes = findPracticeQuizBlocks(sections);
  if (quizzes.length === 0) return true;
  const byBlock = new Map(progress.blocks.map((item) => [item.blockId, item]));
  return quizzes.every((quiz) => byBlock.get(quiz.blockId)?.passed);
}

export function isLessonQuizzesPassed(
  lessonId: string,
  sections: CourseSection[],
  progress: CourseProgress,
): boolean {
  const quizzes = findPracticeQuizBlocks(sections).filter((item) => item.lessonId === lessonId);
  const exam = findFinalExamBlock(sections);
  const examLesson = sections.find((section) => section.isFinalExam)?.lessons[0]?.id;
  const required = [...quizzes];
  if (exam && examLesson === lessonId) {
    required.push({ blockId: exam.blockId, lessonId });
  }
  if (required.length === 0) return true;
  const byBlock = new Map(progress.blocks.map((item) => [item.blockId, item]));
  return required.every((quiz) => byBlock.get(quiz.blockId)?.passed);
}

export function isOnlineProgressComplete(
  progress: CourseProgress,
  finalExamInfo: FinalExamBlockInfo | null,
  requiredAssignments: RequiredAssignmentBlockInfo[] = [],
): boolean {
  if (!areRequiredAssignmentsApproved(progress.assignments, requiredAssignments)) {
    return false;
  }

  if (finalExamInfo) {
    return Boolean(progress.blocks.find((block) => block.blockId === finalExamInfo.blockId)?.passed);
  }

  return progress.totalLessons > 0 && progress.completedLessons >= progress.totalLessons;
}
