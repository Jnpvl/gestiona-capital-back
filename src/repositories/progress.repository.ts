import { pool } from "../config/database";
import { listLatestAssignmentProgress } from "./assignment.repository";
import type {
  BlockProgressItem,
  CourseProgress,
  EnrollmentProgressSummary,
  LessonProgressItem,
  SaveCourseProgressInput,
} from "../types/progress.types";

export interface ActiveEnrollment {
  enrollmentId: string;
  courseId: string;
  enrolledViaCompany: boolean;
  deliveryMode: "online" | "presencial";
  enrolledAt: string;
  completedAt: string | null;
}

export async function findActiveEnrollmentBySlug(
  studentId: string,
  slug: string,
): Promise<ActiveEnrollment | null> {
  const { rows } = await pool.query<{
    enrollment_id: string;
    course_id: string;
    enrolled_via_company: boolean;
    delivery_mode: "online" | "presencial";
    enrolled_at: Date;
    completed_at: Date | null;
  }>(
    `SELECT e.id AS enrollment_id,
            e.course_id,
            e.enrolled_via_company,
            e.delivery_mode,
            e.enrolled_at,
            e.completed_at
     FROM enrollments e
     INNER JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1
       AND c.slug = $2
       AND e.status = 'active'
       AND (e.expires_at IS NULL OR e.expires_at > NOW())
       AND c.status = 'published'
     LIMIT 1`,
    [studentId, slug],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    enrollmentId: row.enrollment_id,
    courseId: row.course_id,
    enrolledViaCompany: row.enrolled_via_company,
    deliveryMode: row.delivery_mode,
    enrolledAt: row.enrolled_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

export async function countCourseLessons(courseId: string): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COUNT(l.id)::text AS total
     FROM lessons l
     INNER JOIN course_sections cs ON cs.id = l.section_id
     WHERE cs.course_id = $1`,
    [courseId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function lessonBelongsToCourse(
  courseId: string,
  lessonId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok
     FROM lessons l
     INNER JOIN course_sections cs ON cs.id = l.section_id
     WHERE cs.course_id = $1 AND l.id = $2
     LIMIT 1`,
    [courseId, lessonId],
  );
  return rows.length > 0;
}

export async function blockBelongsToCourse(
  courseId: string,
  blockId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok
     FROM lesson_blocks lb
     INNER JOIN lessons l ON l.id = lb.lesson_id
     INNER JOIN course_sections cs ON cs.id = l.section_id
     WHERE cs.course_id = $1 AND lb.id = $2
     LIMIT 1`,
    [courseId, blockId],
  );
  return rows.length > 0;
}

export async function getEnrollmentProgressSummary(
  enrollmentId: string,
  courseId: string,
): Promise<EnrollmentProgressSummary> {
  const totalLessons = await countCourseLessons(courseId);
  const { rows } = await pool.query<{ completed: string }>(
    `SELECT COUNT(*)::text AS completed
     FROM lesson_progress
     WHERE enrollment_id = $1 AND completed = TRUE`,
    [enrollmentId],
  );
  const completedLessons = Number(rows[0]?.completed ?? 0);
  const progressPercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return { completedLessons, totalLessons, progressPercent };
}

export async function getCourseProgress(
  enrollmentId: string,
  courseId: string,
): Promise<CourseProgress> {
  const totalLessons = await countCourseLessons(courseId);

  const { rows: enrollmentRows } = await pool.query<{
    last_lesson_id: string | null;
    certificate_number: string | null;
    certificate_issued_at: Date | null;
    dc3_certificate_number: string | null;
    dc3_certificate_issued_at: Date | null;
    enrolled_via_company: boolean;
    delivery_mode: "online" | "presencial";
    completed_at: Date | null;
  }>(
    `SELECT ep.last_lesson_id,
            ep.certificate_number,
            ep.certificate_issued_at,
            ep.dc3_certificate_number,
            ep.dc3_certificate_issued_at,
            e.enrolled_via_company,
            e.delivery_mode,
            e.completed_at
     FROM enrollments e
     LEFT JOIN enrollment_progress ep ON ep.enrollment_id = e.id
     WHERE e.id = $1`,
    [enrollmentId],
  );

  const { rows: lessonRows } = await pool.query<{
    lesson_id: string;
    completed: boolean;
    completed_at: Date | null;
    last_accessed_at: Date;
  }>(
    `SELECT lesson_id, completed, completed_at, last_accessed_at
     FROM lesson_progress
     WHERE enrollment_id = $1`,
    [enrollmentId],
  );

  const { rows: blockRows } = await pool.query<{
    block_id: string;
    answers: Record<string, number>;
    verified: boolean;
    passed: boolean;
    score: number | null;
    total_questions: number | null;
    updated_at: Date;
  }>(
    `SELECT block_id, answers, verified, passed, score, total_questions, updated_at
     FROM block_progress
     WHERE enrollment_id = $1`,
    [enrollmentId],
  );

  const lessons: LessonProgressItem[] = lessonRows.map((row) => ({
    lessonId: row.lesson_id,
    completed: row.completed,
    completedAt: row.completed_at?.toISOString() ?? null,
    lastAccessedAt: row.last_accessed_at.toISOString(),
  }));

  const blocks: BlockProgressItem[] = blockRows.map((row) => ({
    blockId: row.block_id,
    answers: row.answers ?? {},
    verified: row.verified,
    passed: row.passed,
    score: row.score,
    totalQuestions: row.total_questions,
    updatedAt: row.updated_at.toISOString(),
  }));

  const completedLessons = lessons.filter((item) => item.completed).length;
  const progressPercent =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const assignments = await listLatestAssignmentProgress(enrollmentId);

  return {
    lastLessonId: enrollmentRows[0]?.last_lesson_id ?? null,
    completedLessons,
    totalLessons,
    progressPercent,
    certificateNumber: enrollmentRows[0]?.certificate_number ?? null,
    certificateIssuedAt: enrollmentRows[0]?.certificate_issued_at?.toISOString() ?? null,
    dc3CertificateNumber: enrollmentRows[0]?.dc3_certificate_number ?? null,
    dc3CertificateIssuedAt: enrollmentRows[0]?.dc3_certificate_issued_at?.toISOString() ?? null,
    enrolledViaCompany: enrollmentRows[0]?.enrolled_via_company ?? false,
    deliveryMode: enrollmentRows[0]?.delivery_mode ?? "online",
    completedAt: enrollmentRows[0]?.completed_at?.toISOString() ?? null,
    completed: Boolean(enrollmentRows[0]?.completed_at),
    lessons,
    blocks,
    assignments,
  };
}

export async function saveCourseProgress(
  enrollmentId: string,
  input: SaveCourseProgressInput,
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (input.lastLessonId) {
      await client.query(
        `INSERT INTO enrollment_progress (enrollment_id, last_lesson_id, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (enrollment_id)
         DO UPDATE SET last_lesson_id = EXCLUDED.last_lesson_id, updated_at = NOW()`,
        [enrollmentId, input.lastLessonId],
      );
    }

    for (const lesson of input.lessonUpdates ?? []) {
      if (lesson.accessed) {
        await client.query(
          `INSERT INTO lesson_progress (enrollment_id, lesson_id, last_accessed_at, updated_at)
           VALUES ($1, $2, NOW(), NOW())
           ON CONFLICT (enrollment_id, lesson_id)
           DO UPDATE SET last_accessed_at = NOW(), updated_at = NOW()`,
          [enrollmentId, lesson.lessonId],
        );
      }

      if (lesson.completed !== undefined) {
        await client.query(
          `INSERT INTO lesson_progress (enrollment_id, lesson_id, completed, completed_at, last_accessed_at, updated_at)
           VALUES ($1, $2, $3, CASE WHEN $3 THEN NOW() ELSE NULL END, NOW(), NOW())
           ON CONFLICT (enrollment_id, lesson_id)
           DO UPDATE SET
             completed = EXCLUDED.completed,
             completed_at = CASE WHEN EXCLUDED.completed THEN COALESCE(lesson_progress.completed_at, NOW()) ELSE NULL END,
             last_accessed_at = NOW(),
             updated_at = NOW()`,
          [enrollmentId, lesson.lessonId, lesson.completed],
        );
      }
    }

    for (const block of input.blockUpdates ?? []) {
      await client.query(
        `INSERT INTO block_progress (enrollment_id, block_id, answers, verified, passed, score, total_questions, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, NOW())
         ON CONFLICT (enrollment_id, block_id)
         DO UPDATE SET
           answers = COALESCE(EXCLUDED.answers, block_progress.answers),
           verified = COALESCE(EXCLUDED.verified, block_progress.verified),
           passed = CASE WHEN EXCLUDED.passed THEN TRUE ELSE block_progress.passed END,
           score = COALESCE(EXCLUDED.score, block_progress.score),
           total_questions = COALESCE(EXCLUDED.total_questions, block_progress.total_questions),
           updated_at = NOW()`,
        [
          enrollmentId,
          block.blockId,
          JSON.stringify(block.answers ?? {}),
          block.verified ?? false,
          block.passed ?? false,
          block.score ?? null,
          block.totalQuestions ?? null,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function markOnlineEnrollmentCompleted(enrollmentId: string): Promise<boolean> {
  const { rows } = await pool.query<{ id: string }>(
    `UPDATE enrollments
     SET completed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND delivery_mode = 'online' AND completed_at IS NULL
     RETURNING id`,
    [enrollmentId],
  );
  return Boolean(rows[0]);
}

export async function issueCertificateNumber(
  enrollmentId: string,
  certificateNumber: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO enrollment_progress (enrollment_id, certificate_number, certificate_issued_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (enrollment_id)
     DO UPDATE SET
       certificate_number = COALESCE(enrollment_progress.certificate_number, EXCLUDED.certificate_number),
       certificate_issued_at = COALESCE(enrollment_progress.certificate_issued_at, EXCLUDED.certificate_issued_at),
       updated_at = NOW()`,
    [enrollmentId, certificateNumber],
  );
}

export async function issueDc3CertificateNumber(
  enrollmentId: string,
  certificateNumber: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO enrollment_progress (enrollment_id, dc3_certificate_number, dc3_certificate_issued_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (enrollment_id)
     DO UPDATE SET
       dc3_certificate_number = COALESCE(enrollment_progress.dc3_certificate_number, EXCLUDED.dc3_certificate_number),
       dc3_certificate_issued_at = COALESCE(enrollment_progress.dc3_certificate_issued_at, EXCLUDED.dc3_certificate_issued_at),
       updated_at = NOW()`,
    [enrollmentId, certificateNumber],
  );
}

export async function getEnrollmentCertificate(
  enrollmentId: string,
): Promise<{ certificateNumber: string | null; certificateIssuedAt: string | null }> {
  const { rows } = await pool.query<{
    certificate_number: string | null;
    certificate_issued_at: Date | null;
  }>(
    `SELECT certificate_number, certificate_issued_at
     FROM enrollment_progress
     WHERE enrollment_id = $1`,
    [enrollmentId],
  );

  return {
    certificateNumber: rows[0]?.certificate_number ?? null,
    certificateIssuedAt: rows[0]?.certificate_issued_at?.toISOString() ?? null,
  };
}
