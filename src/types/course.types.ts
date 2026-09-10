import type { CourseEnrollmentListItem } from "./student.types";

export type CourseStatus = "draft" | "published";
export type CourseModality = "presencial" | "online" | "hibrido";
export type { CourseEnrollmentListItem };
export type LessonBlockType =
  | "video"
  | "text"
  | "presentation"
  | "quiz"
  | "file"
  | "image"
  | "assignment";

export interface CourseRecord {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  cover_image: string | null;
  modality: string | null;
  duration: string | null;
  level: string | null;
  highlights: string[];
  status: CourseStatus;
  show_in_catalog: boolean;
  featured: boolean;
  certificate_template_url: string | null;
  dc3_template_url: string | null;
  instructor_id: string | null;
  location: string | null;
  period: string | null;
  stps_thematic_area_code: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CourseInstructorSnapshot {
  id: string;
  name: string;
  career: string | null;
  professionalArea: string | null;
  aceStpsRegistration: string | null;
  renapConocer: string | null;
  professionalLicense: string | null;
  photoUrl: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
}

export interface CourseListItem {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  coverImage: string | null;
  modality: string | null;
  status: CourseStatus;
  showInCatalog: boolean;
  featured: boolean;
  lessonsCount: number;
  studentsCount: number;
  createdAt: string;
}

export interface CoursePublicCard {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  coverImage: string | null;
  modality: string | null;
  duration: string | null;
  level: string | null;
  featured: boolean;
}

export interface CoursePublicDetail extends CoursePublicCard {
  description: string | null;
  highlights: string[];
}

export interface LessonBlock {
  id: string;
  type: LessonBlockType;
  title: string | null;
  content: string | null;
  resourceUrl: string | null;
  sortOrder: number;
}

export interface Lesson {
  id: string;
  title: string;
  sortOrder: number;
  blocks: LessonBlock[];
}

export interface CourseSection {
  id: string;
  title: string;
  sortOrder: number;
  isFinalExam: boolean;
  lessons: Lesson[];
}

export interface CourseDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  coverImage: string | null;
  modality: CourseModality | null;
  duration: string | null;
  level: string | null;
  highlights: string[];
  status: CourseStatus;
  showInCatalog: boolean;
  featured: boolean;
  certificateTemplateUrl: string | null;
  dc3TemplateUrl: string | null;
  instructorId: string | null;
  location: string | null;
  period: string | null;
  stpsThematicAreaCode: string | null;
  stpsThematicAreaName: string | null;
  instructor: CourseInstructorSnapshot | null;
  sections: CourseSection[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCourseInput {
  title: string;
  slug?: string;
  instructorId?: string | null;
}

export interface UpdateCoursePromotionInput {
  title?: string;
  slug?: string;
  description?: string | null;
  shortDescription?: string | null;
  coverImage?: string | null;
  modality?: CourseModality | null;
  duration?: string | null;
  level?: string | null;
  highlights?: string[];
  status?: CourseStatus;
  showInCatalog?: boolean;
  featured?: boolean;
  certificateTemplateUrl?: string | null;
  dc3TemplateUrl?: string | null;
  location?: string | null;
  period?: string | null;
  stpsThematicAreaCode?: string | null;
  instructorId?: string | null;
}

export interface SectionInput {
  id?: string;
  title: string;
  sortOrder: number;
  isFinalExam?: boolean;
  lessons: LessonInput[];
}

export interface LessonInput {
  id?: string;
  title: string;
  sortOrder: number;
  blocks: {
    id?: string;
    type: LessonBlockType;
    title?: string | null;
    content?: string | null;
    resourceUrl?: string | null;
    sortOrder: number;
  }[];
}

export interface ListCoursesFilters {
  search?: string;
  status?: CourseStatus;
  /** When set, only courses owned by this instructor. */
  instructorId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedCoursesResult {
  courses: CourseListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
