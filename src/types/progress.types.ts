import type { AssignmentProgressItem } from "./assignment.types";

export interface LessonProgressItem {
  lessonId: string;
  completed: boolean;
  completedAt: string | null;
  lastAccessedAt: string;
}

export interface BlockProgressItem {
  blockId: string;
  answers: Record<string, number>;
  verified: boolean;
  passed: boolean;
  score: number | null;
  totalQuestions: number | null;
  updatedAt: string;
}

export interface CourseProgress {
  lastLessonId: string | null;
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
  certificateNumber: string | null;
  certificateIssuedAt: string | null;
  dc3CertificateNumber: string | null;
  dc3CertificateIssuedAt: string | null;
  enrolledViaCompany: boolean;
  deliveryMode: "online" | "presencial";
  completedAt: string | null;
  completed: boolean;
  lessons: LessonProgressItem[];
  blocks: BlockProgressItem[];
  assignments: AssignmentProgressItem[];
}

export interface SaveCourseProgressInput {
  lastLessonId?: string;
  lessonUpdates?: Array<{
    lessonId: string;
    completed?: boolean;
    accessed?: boolean;
  }>;
  blockUpdates?: Array<{
    blockId: string;
    answers?: Record<string, number>;
    verified?: boolean;
    passed?: boolean;
    score?: number;
    totalQuestions?: number;
  }>;
}

export interface EnrollmentProgressSummary {
  completedLessons: number;
  totalLessons: number;
  progressPercent: number;
}
