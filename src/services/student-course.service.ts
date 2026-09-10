import { AppError } from "../errors/app-error";
import { findCourseDetailById } from "../repositories/course.repository";
import {
  findActiveEnrollmentCourseId,
  findActiveStudentCourses,
} from "../repositories/student.repository";
import type { CourseDetail } from "../types/course.types";
import type { StudentCourseListItem } from "../types/student.types";

export class StudentCourseService {
  async listEnrolledCourses(studentId: string): Promise<StudentCourseListItem[]> {
    return findActiveStudentCourses(studentId);
  }

  async getEnrolledCourseBySlug(studentId: string, slug: string): Promise<CourseDetail> {
    const courseId = await findActiveEnrollmentCourseId(studentId, slug);

    if (!courseId) {
      throw new AppError(403, "No tienes acceso a este curso", "COURSE_ACCESS_DENIED");
    }

    const course = await findCourseDetailById(courseId);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }

    return course;
  }
}

export const studentCourseService = new StudentCourseService();
