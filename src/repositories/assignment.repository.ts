import { pool } from "../config/database";
import type {
  AssignmentProgressItem,
  AssignmentSubmissionListItem,
  AssignmentSubmissionStatus,
} from "../types/assignment.types";

interface SubmissionRow {
  id: string;
  enrollment_id: string;
  block_id: string;
  attempt_number: number;
  file_url: string;
  file_name: string | null;
  student_comment: string | null;
  status: AssignmentSubmissionStatus;
  reviewer_comment: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  submitted_at: Date;
}

function mapProgressItem(row: SubmissionRow | undefined, blockId: string): AssignmentProgressItem {
  if (!row) {
    return {
      blockId,
      submissionId: null,
      status: "none",
      attemptNumber: 0,
      fileUrl: null,
      fileName: null,
      studentComment: null,
      reviewerComment: null,
      submittedAt: null,
      reviewedAt: null,
    };
  }

  return {
    blockId: row.block_id,
    submissionId: row.id,
    status: row.status,
    attemptNumber: row.attempt_number,
    fileUrl: row.file_url,
    fileName: row.file_name,
    studentComment: row.student_comment,
    reviewerComment: row.reviewer_comment,
    submittedAt: row.submitted_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
  };
}

export async function listLatestAssignmentProgress(
  enrollmentId: string,
): Promise<AssignmentProgressItem[]> {
  const { rows } = await pool.query<SubmissionRow>(
    `SELECT DISTINCT ON (block_id)
            id, enrollment_id, block_id, attempt_number, file_url, file_name,
            student_comment, status, reviewer_comment, reviewed_by, reviewed_at, submitted_at
     FROM assignment_submissions
     WHERE enrollment_id = $1
     ORDER BY block_id, attempt_number DESC`,
    [enrollmentId],
  );

  return rows.map((row) => mapProgressItem(row, row.block_id));
}

export async function getLatestSubmission(
  enrollmentId: string,
  blockId: string,
): Promise<AssignmentProgressItem> {
  const { rows } = await pool.query<SubmissionRow>(
    `SELECT id, enrollment_id, block_id, attempt_number, file_url, file_name,
            student_comment, status, reviewer_comment, reviewed_by, reviewed_at, submitted_at
     FROM assignment_submissions
     WHERE enrollment_id = $1 AND block_id = $2
     ORDER BY attempt_number DESC
     LIMIT 1`,
    [enrollmentId, blockId],
  );

  return mapProgressItem(rows[0], blockId);
}

export async function createAssignmentSubmission(input: {
  enrollmentId: string;
  blockId: string;
  fileUrl: string;
  fileName: string | null;
  studentComment: string | null;
}): Promise<AssignmentProgressItem> {
  const latest = await getLatestSubmission(input.enrollmentId, input.blockId);
  if (latest.status === "pending") {
    throw new Error("PENDING_SUBMISSION_EXISTS");
  }
  if (latest.status === "approved") {
    throw new Error("ALREADY_APPROVED");
  }

  const nextAttempt = latest.attemptNumber + 1;

  const { rows } = await pool.query<SubmissionRow>(
    `INSERT INTO assignment_submissions (
       enrollment_id, block_id, attempt_number, file_url, file_name, student_comment, status
     ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING id, enrollment_id, block_id, attempt_number, file_url, file_name,
               student_comment, status, reviewer_comment, reviewed_by, reviewed_at, submitted_at`,
    [
      input.enrollmentId,
      input.blockId,
      nextAttempt,
      input.fileUrl,
      input.fileName,
      input.studentComment,
    ],
  );

  return mapProgressItem(rows[0], input.blockId);
}

export async function listCourseAssignmentSubmissions(
  courseId: string,
  status?: AssignmentSubmissionStatus | "all",
): Promise<AssignmentSubmissionListItem[]> {
  const params: unknown[] = [courseId];
  let statusFilter = "";
  if (status && status !== "all") {
    params.push(status);
    statusFilter = `AND asub.status = $${params.length}`;
  }

  const { rows } = await pool.query<{
    id: string;
    enrollment_id: string;
    block_id: string;
    attempt_number: number;
    file_url: string;
    file_name: string | null;
    student_comment: string | null;
    status: AssignmentSubmissionStatus;
    reviewer_comment: string | null;
    reviewed_by: string | null;
    reviewed_at: Date | null;
    submitted_at: Date;
    student_name: string;
    student_email: string;
    assignment_title: string | null;
    lesson_title: string;
    section_title: string;
  }>(
    `SELECT asub.id,
            asub.enrollment_id,
            asub.block_id,
            asub.attempt_number,
            asub.file_url,
            asub.file_name,
            asub.student_comment,
            asub.status,
            asub.reviewer_comment,
            asub.reviewed_by,
            asub.reviewed_at,
            asub.submitted_at,
            COALESCE(
              NULLIF(TRIM(CONCAT_WS(' ', s.first_names, s.paternal_last_name, s.maternal_last_name)), ''),
              s.name
            ) AS student_name,
            s.email AS student_email,
            lb.title AS assignment_title,
            l.title AS lesson_title,
            cs.title AS section_title
     FROM assignment_submissions asub
     INNER JOIN lesson_blocks lb ON lb.id = asub.block_id
     INNER JOIN lessons l ON l.id = lb.lesson_id
     INNER JOIN course_sections cs ON cs.id = l.section_id
     INNER JOIN enrollments e ON e.id = asub.enrollment_id
     INNER JOIN students s ON s.id = e.student_id
     WHERE cs.course_id = $1
       ${statusFilter}
     ORDER BY
       CASE asub.status
         WHEN 'pending' THEN 0
         WHEN 'returned' THEN 1
         ELSE 2
       END,
       asub.submitted_at DESC`,
    params,
  );

  return rows.map((row) => ({
    id: row.id,
    enrollmentId: row.enrollment_id,
    blockId: row.block_id,
    attemptNumber: row.attempt_number,
    fileUrl: row.file_url,
    fileName: row.file_name,
    studentComment: row.student_comment,
    status: row.status,
    reviewerComment: row.reviewer_comment,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    submittedAt: row.submitted_at.toISOString(),
    studentName: row.student_name || row.student_email,
    studentEmail: row.student_email,
    assignmentTitle: row.assignment_title,
    lessonTitle: row.lesson_title,
    sectionTitle: row.section_title,
  }));
}

export async function findSubmissionForCourse(
  courseId: string,
  submissionId: string,
): Promise<{
  id: string;
  enrollmentId: string;
  blockId: string;
  lessonId: string;
  status: AssignmentSubmissionStatus;
  studentName: string;
  studentEmail: string;
  assignmentTitle: string;
  courseTitle: string;
  courseSlug: string;
} | null> {
  const { rows } = await pool.query<{
    id: string;
    enrollment_id: string;
    block_id: string;
    lesson_id: string;
    status: AssignmentSubmissionStatus;
    student_name: string;
    student_email: string;
    assignment_title: string | null;
    course_title: string;
    course_slug: string;
  }>(
    `SELECT asub.id,
            asub.enrollment_id,
            asub.block_id,
            l.id AS lesson_id,
            asub.status,
            COALESCE(
              NULLIF(TRIM(CONCAT_WS(' ', s.first_names, s.paternal_last_name, s.maternal_last_name)), ''),
              s.name
            ) AS student_name,
            s.email AS student_email,
            lb.title AS assignment_title,
            c.title AS course_title,
            c.slug AS course_slug
     FROM assignment_submissions asub
     INNER JOIN lesson_blocks lb ON lb.id = asub.block_id
     INNER JOIN lessons l ON l.id = lb.lesson_id
     INNER JOIN course_sections cs ON cs.id = l.section_id
     INNER JOIN courses c ON c.id = cs.course_id
     INNER JOIN enrollments e ON e.id = asub.enrollment_id
     INNER JOIN students s ON s.id = e.student_id
     WHERE cs.course_id = $1 AND asub.id = $2
     LIMIT 1`,
    [courseId, submissionId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    blockId: row.block_id,
    lessonId: row.lesson_id,
    status: row.status,
    studentName: row.student_name || row.student_email,
    studentEmail: row.student_email,
    assignmentTitle: row.assignment_title?.trim() || "Tarea",
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
  };
}

export async function reviewAssignmentSubmission(input: {
  submissionId: string;
  status: "approved" | "returned";
  reviewerComment: string | null;
  reviewedBy: string;
}): Promise<void> {
  await pool.query(
    `UPDATE assignment_submissions
     SET status = $2,
         reviewer_comment = $3,
         reviewed_by = $4,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [input.submissionId, input.status, input.reviewerComment, input.reviewedBy],
  );
}

export async function countPendingSubmissionsForCourse(courseId: string): Promise<number> {
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM assignment_submissions asub
     INNER JOIN lesson_blocks lb ON lb.id = asub.block_id
     INNER JOIN lessons l ON l.id = lb.lesson_id
     INNER JOIN course_sections cs ON cs.id = l.section_id
     WHERE cs.course_id = $1 AND asub.status = 'pending'`,
    [courseId],
  );
  return Number(rows[0]?.total ?? 0);
}

export async function areRequiredAssignmentsApprovedForEnrollment(
  enrollmentId: string,
  requiredBlockIds: string[],
): Promise<boolean> {
  if (requiredBlockIds.length === 0) return true;

  const { rows } = await pool.query<{ block_id: string }>(
    `SELECT DISTINCT ON (block_id) block_id
     FROM assignment_submissions
     WHERE enrollment_id = $1
       AND block_id = ANY($2::uuid[])
       AND status = 'approved'
     ORDER BY block_id, attempt_number DESC`,
    [enrollmentId, requiredBlockIds],
  );

  return rows.length >= requiredBlockIds.length;
}

export async function getAssignmentBlockMeta(
  courseId: string,
  blockId: string,
): Promise<{
  blockId: string;
  lessonId: string;
  type: string;
  content: string | null;
  title: string | null;
} | null> {
  const { rows } = await pool.query<{
    id: string;
    lesson_id: string;
    type: string;
    content: string | null;
    title: string | null;
  }>(
    `SELECT lb.id, lb.lesson_id, lb.type, lb.content, lb.title
     FROM lesson_blocks lb
     INNER JOIN lessons l ON l.id = lb.lesson_id
     INNER JOIN course_sections cs ON cs.id = l.section_id
     WHERE cs.course_id = $1 AND lb.id = $2
     LIMIT 1`,
    [courseId, blockId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    blockId: row.id,
    lessonId: row.lesson_id,
    type: row.type,
    content: row.content,
    title: row.title,
  };
}
