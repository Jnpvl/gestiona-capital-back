import bcrypt from "bcrypt";
import { pool } from "../config/database";
import { findCompanyById } from "./company.repository";
import { formatStudentFullName } from "../shared/utils/student-name";
import type {
  CreateStudentInput,
  ListStudentsFilters,
  StudentCourseListItem,
  StudentDetail,
  StudentEnrollment,
  StudentListItem,
  StudentPublic,
  StudentRecord,
  StudentRecordRow,
  UpdateStudentInput,
  PaginatedStudentsResult,
  CourseEnrollmentListItem,
  EnrollmentDeliveryMode,
} from "../types/student.types";

function isOnlineProgressComplete(input: {
  lessonsCount: number;
  completedLessons: number;
  hasFinalExam: boolean;
  finalExamPassed: boolean | null;
}): boolean {
  const courseCompleted = input.lessonsCount > 0 && input.completedLessons >= input.lessonsCount;
  const examPassed = input.hasFinalExam ? Boolean(input.finalExamPassed) : true;
  return courseCompleted && examPassed;
}

function resolveEnrollmentCompletion(input: {
  deliveryMode: EnrollmentDeliveryMode;
  completedAt: Date | null;
  lessonsCount: number;
  completedLessons: number;
  hasFinalExam: boolean;
  finalExamPassed: boolean | null;
}): boolean {
  if (input.completedAt) return true;
  if (input.deliveryMode === "presencial") return false;
  return isOnlineProgressComplete(input);
}

export function toStudentPublic(student: StudentRecord): StudentPublic {
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    active: student.active,
    privacyAccepted: Boolean(student.privacy_accepted_at),
    createdAt: student.created_at.toISOString(),
  };
}

function resolveNameParts(input: {
  paternalLastName?: string;
  maternalLastName?: string | null;
  firstNames?: string;
}) {
  return {
    paternalLastName: input.paternalLastName?.trim() ?? "",
    maternalLastName: input.maternalLastName?.trim() || null,
    firstNames: input.firstNames?.trim() ?? "",
  };
}

function mapListItem(row: StudentRecordRow & { courses_count: string }): StudentListItem {
  return {
    id: row.id,
    name: row.name,
    paternalLastName: row.paternal_last_name ?? "",
    maternalLastName: row.maternal_last_name ?? null,
    firstNames: row.first_names ?? "",
    email: row.email,
    phone: row.phone,
    companyName: row.company_name ?? null,
    alumnoType: row.alumno_type,
    active: row.active,
    coursesCount: Number(row.courses_count),
    createdAt: row.created_at.toISOString(),
  };
}

function mapDetail(row: StudentRecordRow): StudentDetail {
  return {
    id: row.id,
    name: row.name,
    paternalLastName: row.paternal_last_name ?? "",
    maternalLastName: row.maternal_last_name ?? null,
    firstNames: row.first_names ?? "",
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    curp: row.curp,
    gender: row.gender,
    age: row.age,
    residenceLocation: row.residence_location,
    educationLevel: row.education_level,
    professionArea: row.profession_area,
    educationInstitution: row.education_institution,
    currentlyEmployed: row.currently_employed,
    jobType: row.job_type,
    currentPosition: row.current_position,
    industrySector: row.industry_sector,
    yearsExperience: row.years_experience,
    timeInCurrentPosition: row.time_in_current_position,
    stpsOccupationCode: row.stps_occupation_code,
    stpsOccupationName: row.stps_occupation_name ?? null,
    stpsThematicAreaCode: row.stps_thematic_area_code,
    stpsThematicAreaName: row.stps_thematic_area_name ?? null,
    alumnoType: row.alumno_type,
    companyId: row.company_id,
    companyName: row.company_name ?? null,
    companyRfc: row.company_rfc ?? null,
    active: row.active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function resolveStudentCompanyId(companyId?: string | null): Promise<string | null> {
  if (!companyId) {
    return null;
  }

  const company = await findCompanyById(companyId);
  if (!company) {
    throw new Error("COMPANY_NOT_FOUND");
  }

  return company.id;
}

function trimOrNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildWhereClause(filters: ListStudentsFilters) {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.active !== undefined) {
    values.push(filters.active);
    conditions.push(`s.active = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search.toLowerCase()}%`);
    const index = values.length;
    conditions.push(
      `(LOWER(s.name) LIKE $${index}
        OR LOWER(s.email) LIKE $${index}
        OR LOWER(COALESCE(s.first_names, '')) LIKE $${index}
        OR LOWER(COALESCE(s.paternal_last_name, '')) LIKE $${index}
        OR LOWER(COALESCE(s.maternal_last_name, '')) LIKE $${index})`,
    );
  }

  if (filters.alumnoType) {
    values.push(filters.alumnoType);
    conditions.push(`s.alumno_type = $${values.length}`);
  }

  if (filters.instructorId) {
    values.push(filters.instructorId);
    const index = values.length;
    conditions.push(`(
      s.created_by_staff_id = $${index}
      OR EXISTS (
        SELECT 1
        FROM enrollments e
        INNER JOIN courses c ON c.id = e.course_id
        WHERE e.student_id = s.id
          AND c.instructor_id = $${index}
      )
    )`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, values };
}

export async function findStudentsPaginated(
  filters: ListStudentsFilters = {},
): Promise<PaginatedStudentsResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
  const offset = (page - 1) * limit;

  const { where, values } = buildWhereClause(filters);

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM students s ${where}`,
    values,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const listValues = [...values, limit, offset];
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  const { rows } = await pool.query<StudentRecordRow & { courses_count: string }>(
    `SELECT s.*,
            co.name AS company_name,
            COUNT(e.id) FILTER (WHERE e.status = 'active') AS courses_count
     FROM students s
     LEFT JOIN companies co ON co.id = s.company_id
     LEFT JOIN enrollments e ON e.student_id = s.id
     ${where}
     GROUP BY s.id, co.name
     ORDER BY s.created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    listValues,
  );

  return {
    students: rows.map(mapListItem),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function findStudentById(id: string): Promise<StudentDetail | null> {
  const { rows } = await pool.query<StudentRecordRow>(
    `SELECT s.*,
            co.name AS company_name,
            co.rfc AS company_rfc,
            occ.name AS stps_occupation_name,
            area.name AS stps_thematic_area_name
     FROM students s
     LEFT JOIN companies co ON co.id = s.company_id
     LEFT JOIN stps_occupations occ ON occ.code = s.stps_occupation_code
     LEFT JOIN stps_thematic_areas area ON area.code = s.stps_thematic_area_code
     WHERE s.id = $1
     LIMIT 1`,
    [id],
  );
  return rows[0] ? mapDetail(rows[0]) : null;
}

export async function isStudentAccessibleToInstructor(
  studentId: string,
  instructorId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ ok: number }>(
    `SELECT 1 AS ok
     FROM students s
     WHERE s.id = $1
       AND (
         s.created_by_staff_id = $2
         OR EXISTS (
           SELECT 1
           FROM enrollments e
           INNER JOIN courses c ON c.id = e.course_id
           WHERE e.student_id = s.id
             AND c.instructor_id = $2
         )
       )
     LIMIT 1`,
    [studentId, instructorId],
  );
  return rows.length > 0;
}

export async function findStudentRecordById(id: string): Promise<StudentRecord | null> {
  const { rows } = await pool.query<StudentRecord>(
    "SELECT * FROM students WHERE id = $1 LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function findStudentByCurp(curp: string): Promise<StudentDetail | null> {
  const { rows } = await pool.query<StudentRecordRow>(
    `SELECT s.*,
            co.name AS company_name,
            co.rfc AS company_rfc,
            occ.name AS stps_occupation_name,
            area.name AS stps_thematic_area_name
     FROM students s
     LEFT JOIN companies co ON co.id = s.company_id
     LEFT JOIN stps_occupations occ ON occ.code = s.stps_occupation_code
     LEFT JOIN stps_thematic_areas area ON area.code = s.stps_thematic_area_code
     WHERE UPPER(s.curp) = UPPER($1)
     LIMIT 1`,
    [curp.trim()],
  );
  return rows[0] ? mapDetail(rows[0]) : null;
}

export async function findStudentByEmail(email: string): Promise<StudentRecord | null> {
  const { rows } = await pool.query<StudentRecord>(
    "SELECT * FROM students WHERE email = $1 LIMIT 1",
    [email.toLowerCase()],
  );
  return rows[0] ?? null;
}

export async function findStudentEnrollments(
  studentId: string,
  options: { instructorId?: string } = {},
): Promise<StudentEnrollment[]> {
  const values: unknown[] = [studentId];
  let instructorFilter = "";
  if (options.instructorId) {
    values.push(options.instructorId);
    instructorFilter = `AND c.instructor_id = $${values.length}`;
  }

  const { rows } = await pool.query<{
    id: string;
    course_id: string;
    course_title: string;
    course_slug: string;
    status: StudentEnrollment["status"];
    enrolled_at: Date;
    expires_at: Date | null;
    enrolled_via_company: boolean;
    delivery_mode: EnrollmentDeliveryMode;
    completed_at: Date | null;
    dc3_template_url: string | null;
    lessons_count: string;
    completed_lessons: string;
    has_final_exam: boolean;
    final_exam_passed: boolean | null;
  }>(
    `SELECT e.id,
            e.course_id,
            c.title AS course_title,
            c.slug AS course_slug,
            e.status,
            e.enrolled_at,
            e.expires_at,
            e.enrolled_via_company,
            e.delivery_mode,
            e.completed_at,
            c.dc3_template_url,
            COUNT(DISTINCT l.id)::text AS lessons_count,
            COUNT(DISTINCT lp.lesson_id) FILTER (WHERE lp.completed = TRUE)::text AS completed_lessons,
            BOOL_OR(final_exam.block_id IS NOT NULL) AS has_final_exam,
            BOOL_OR(bp_exam.passed) FILTER (WHERE final_exam.block_id IS NOT NULL) AS final_exam_passed
     FROM enrollments e
     INNER JOIN courses c ON c.id = e.course_id
     LEFT JOIN course_sections cs ON cs.course_id = c.id
     LEFT JOIN lessons l ON l.section_id = cs.id
     LEFT JOIN lesson_progress lp ON lp.enrollment_id = e.id AND lp.lesson_id = l.id
     LEFT JOIN LATERAL (
       SELECT lb.id AS block_id
       FROM course_sections cs_fe
       INNER JOIN lessons l_fe ON l_fe.section_id = cs_fe.id
       INNER JOIN lesson_blocks lb ON lb.lesson_id = l_fe.id AND lb.type = 'quiz'
       WHERE cs_fe.course_id = c.id AND cs_fe.is_final_exam = TRUE
       ORDER BY l_fe.sort_order ASC, lb.sort_order ASC
       LIMIT 1
     ) final_exam ON TRUE
     LEFT JOIN block_progress bp_exam
       ON bp_exam.enrollment_id = e.id AND bp_exam.block_id = final_exam.block_id
     WHERE e.student_id = $1
       ${instructorFilter}
     GROUP BY e.id, c.id
     ORDER BY e.enrolled_at DESC`,
    values,
  );

  return rows.map((row) => {
    const lessonsCount = Number(row.lessons_count);
    const completedLessons = Number(row.completed_lessons);
    const completed = resolveEnrollmentCompletion({
      deliveryMode: row.delivery_mode,
      completedAt: row.completed_at,
      lessonsCount,
      completedLessons,
      hasFinalExam: row.has_final_exam,
      finalExamPassed: row.final_exam_passed,
    });

    return {
      id: row.id,
      courseId: row.course_id,
      courseTitle: row.course_title,
      courseSlug: row.course_slug,
      status: row.status,
      enrolledAt: row.enrolled_at.toISOString(),
      expiresAt: row.expires_at?.toISOString() ?? null,
      enrolledViaCompany: row.enrolled_via_company,
      deliveryMode: row.delivery_mode,
      completedAt: row.completed_at?.toISOString() ?? null,
      completed,
      canDownloadCertificate: completed,
      canDownloadDc3: completed && row.enrolled_via_company,
    };
  });
}

export async function assignCourseToStudent(
  studentId: string,
  courseId: string,
  enrolledViaCompany = false,
  deliveryMode: EnrollmentDeliveryMode = "online",
): Promise<StudentEnrollment> {
  const student = await findStudentById(studentId);
  if (!student) {
    throw new Error("STUDENT_NOT_FOUND");
  }

  const { rows: courseRows } = await pool.query<{ id: string; status: string }>(
    "SELECT id, status FROM courses WHERE id = $1 LIMIT 1",
    [courseId],
  );
  const course = courseRows[0];
  if (!course) {
    throw new Error("COURSE_NOT_FOUND");
  }
  if (course.status !== "published") {
    throw new Error("COURSE_NOT_PUBLISHED");
  }

  const { rows: existingRows } = await pool.query<{ id: string; status: string }>(
    "SELECT id, status FROM enrollments WHERE student_id = $1 AND course_id = $2 LIMIT 1",
    [studentId, courseId],
  );
  const existing = existingRows[0];

  if (existing?.status === "active") {
    throw new Error("ENROLLMENT_EXISTS");
  }

  if (existing) {
    await pool.query(
      `UPDATE enrollments
       SET status = 'active',
           enrolled_at = NOW(),
           enrolled_via_company = $2,
           delivery_mode = $3,
           completed_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [existing.id, enrolledViaCompany, deliveryMode],
    );
  } else {
    await pool.query(
      `INSERT INTO enrollments (student_id, course_id, status, enrolled_via_company, delivery_mode)
       VALUES ($1, $2, 'active', $3, $4)`,
      [studentId, courseId, enrolledViaCompany, deliveryMode],
    );
  }

  const enrollments = await findStudentEnrollments(studentId);
  const enrollment = enrollments.find((item) => item.courseId === courseId);
  if (!enrollment) {
    throw new Error("ENROLLMENT_CREATE_FAILED");
  }

  return enrollment;
}

export async function revokeStudentEnrollment(
  studentId: string,
  enrollmentId: string,
): Promise<StudentEnrollment> {
  const { rows } = await pool.query<{ id: string; status: string }>(
    `UPDATE enrollments
     SET status = 'revoked', updated_at = NOW()
     WHERE id = $1 AND student_id = $2 AND status = 'active'
     RETURNING id, status`,
    [enrollmentId, studentId],
  );

  if (!rows[0]) {
    throw new Error("ENROLLMENT_NOT_FOUND");
  }

  const enrollments = await findStudentEnrollments(studentId);
  const enrollment = enrollments.find((item) => item.id === enrollmentId);
  if (!enrollment) {
    throw new Error("ENROLLMENT_NOT_FOUND");
  }

  return enrollment;
}

export async function createStudent(input: CreateStudentInput): Promise<StudentDetail> {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const companyId = await resolveStudentCompanyId(input.companyId);
  const nameParts = resolveNameParts(input);
  const fullName = formatStudentFullName(nameParts);

  const { rows } = await pool.query<StudentRecordRow>(
    `INSERT INTO students (
       name, paternal_last_name, maternal_last_name, first_names,
       email, password_hash, phone, notes, company_id,
       curp, gender, age, residence_location,
       education_level, profession_area, education_institution,
       currently_employed, job_type, current_position, industry_sector,
       years_experience, time_in_current_position,
       stps_occupation_code, stps_thematic_area_code, alumno_type, active,
       created_by_staff_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
     RETURNING *`,
    [
      fullName,
      nameParts.paternalLastName,
      nameParts.maternalLastName,
      nameParts.firstNames,
      input.email.toLowerCase().trim(),
      passwordHash,
      input.phone.trim(),
      input.notes?.trim() || null,
      companyId,
      input.curp.trim().toUpperCase(),
      input.gender,
      input.age,
      input.residenceLocation.trim(),
      input.educationLevel ?? null,
      trimOrNull(input.professionArea),
      trimOrNull(input.educationInstitution),
      input.currentlyEmployed ?? null,
      input.jobType ?? null,
      trimOrNull(input.currentPosition),
      trimOrNull(input.industrySector),
      input.yearsExperience ?? null,
      trimOrNull(input.timeInCurrentPosition),
      trimOrNull(input.stpsOccupationCode),
      trimOrNull(input.stpsThematicAreaCode),
      input.alumnoType,
      input.active ?? true,
      input.createdByStaffId ?? null,
    ],
  );

  const created = await findStudentById(rows[0].id);
  if (!created) {
    throw new Error("STUDENT_CREATE_FAILED");
  }

  return created;
}

export async function updateStudent(
  id: string,
  input: UpdateStudentInput,
): Promise<StudentDetail | null> {
  const current = await findStudentRecordById(id);
  if (!current) return null;

  const passwordHash = input.password
    ? await bcrypt.hash(input.password, 12)
    : current.password_hash;

  const alumnoType = input.alumnoType ?? current.alumno_type;

  const companyId =
    input.companyId !== undefined
      ? await resolveStudentCompanyId(input.companyId)
      : current.company_id;

  const nameParts = resolveNameParts({
    paternalLastName: input.paternalLastName ?? current.paternal_last_name ?? "",
    maternalLastName:
      input.maternalLastName !== undefined
        ? input.maternalLastName
        : current.maternal_last_name,
    firstNames: input.firstNames ?? current.first_names ?? "",
  });
  const fullName = formatStudentFullName(nameParts);

  const { rows } = await pool.query<StudentRecord>(
    `UPDATE students
     SET name = $1,
         paternal_last_name = $2,
         maternal_last_name = $3,
         first_names = $4,
         email = $5,
         phone = $6,
         notes = $7,
         company_id = $8,
         curp = $9,
         gender = $10,
         age = $11,
         residence_location = $12,
         education_level = $13,
         profession_area = $14,
         education_institution = $15,
         currently_employed = $16,
         job_type = $17,
         current_position = $18,
         industry_sector = $19,
         years_experience = $20,
         time_in_current_position = $21,
         stps_occupation_code = $22,
         stps_thematic_area_code = $23,
         alumno_type = $24,
         active = $25,
         password_hash = $26,
         updated_at = NOW()
     WHERE id = $27
     RETURNING id`,
    [
      fullName,
      nameParts.paternalLastName,
      nameParts.maternalLastName,
      nameParts.firstNames,
      (input.email ?? current.email).toLowerCase().trim(),
      input.phone !== undefined ? input.phone?.trim() || null : current.phone,
      input.notes !== undefined ? input.notes?.trim() || null : current.notes,
      companyId,
      input.curp !== undefined ? input.curp?.trim().toUpperCase() || null : current.curp,
      input.gender !== undefined ? input.gender : current.gender,
      input.age !== undefined ? input.age : current.age,
      input.residenceLocation !== undefined
        ? input.residenceLocation?.trim() || null
        : current.residence_location,
      input.educationLevel !== undefined ? input.educationLevel : current.education_level,
      input.professionArea !== undefined
        ? trimOrNull(input.professionArea)
        : current.profession_area,
      input.educationInstitution !== undefined
        ? trimOrNull(input.educationInstitution)
        : current.education_institution,
      input.currentlyEmployed !== undefined
        ? input.currentlyEmployed
        : current.currently_employed,
      input.jobType !== undefined ? input.jobType : current.job_type,
      input.currentPosition !== undefined
        ? trimOrNull(input.currentPosition)
        : current.current_position,
      input.industrySector !== undefined
        ? trimOrNull(input.industrySector)
        : current.industry_sector,
      input.yearsExperience !== undefined ? input.yearsExperience : current.years_experience,
      input.timeInCurrentPosition !== undefined
        ? trimOrNull(input.timeInCurrentPosition)
        : current.time_in_current_position,
      input.stpsOccupationCode !== undefined
        ? trimOrNull(input.stpsOccupationCode)
        : current.stps_occupation_code,
      input.stpsThematicAreaCode !== undefined
        ? trimOrNull(input.stpsThematicAreaCode)
        : current.stps_thematic_area_code,
      alumnoType,
      input.active ?? current.active,
      passwordHash,
      id,
    ],
  );

  return rows[0] ? findStudentById(rows[0].id) : null;
}

export async function setStudentActive(
  id: string,
  active: boolean,
): Promise<StudentDetail | null> {
  const { rows } = await pool.query<StudentRecord>(
    `UPDATE students
     SET active = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id`,
    [active, id],
  );
  return rows[0] ? findStudentById(rows[0].id) : null;
}

export async function verifyStudentPassword(
  student: StudentRecord,
  password: string,
): Promise<boolean> {
  return bcrypt.compare(password, student.password_hash);
}

export async function findActiveStudentCourses(
  studentId: string,
): Promise<StudentCourseListItem[]> {
  const { rows } = await pool.query<{
    enrollment_id: string;
    course_id: string;
    title: string;
    slug: string;
    short_description: string | null;
    cover_image: string | null;
    modality: string | null;
    enrolled_at: Date;
    lessons_count: string;
    completed_lessons: string;
    certificate_template_url: string | null;
    dc3_template_url: string | null;
    has_final_exam: boolean;
    final_exam_passed: boolean | null;
    enrolled_via_company: boolean;
    delivery_mode: EnrollmentDeliveryMode;
    completed_at: Date | null;
  }>(
    `SELECT e.id AS enrollment_id,
            c.id AS course_id,
            c.title,
            c.slug,
            c.short_description,
            c.cover_image,
            c.modality,
            e.enrolled_at,
            e.enrolled_via_company,
            e.delivery_mode,
            e.completed_at,
            COUNT(DISTINCT l.id)::text AS lessons_count,
            COUNT(DISTINCT lp.lesson_id) FILTER (WHERE lp.completed = TRUE)::text AS completed_lessons,
            c.certificate_template_url,
            c.dc3_template_url,
            BOOL_OR(final_exam.block_id IS NOT NULL) AS has_final_exam,
            BOOL_OR(bp_exam.passed) FILTER (WHERE final_exam.block_id IS NOT NULL) AS final_exam_passed
     FROM enrollments e
     INNER JOIN courses c ON c.id = e.course_id
     LEFT JOIN course_sections cs ON cs.course_id = c.id
     LEFT JOIN lessons l ON l.section_id = cs.id
     LEFT JOIN lesson_progress lp ON lp.enrollment_id = e.id AND lp.lesson_id = l.id
     LEFT JOIN LATERAL (
       SELECT lb.id AS block_id
       FROM course_sections cs_fe
       INNER JOIN lessons l_fe ON l_fe.section_id = cs_fe.id
       INNER JOIN lesson_blocks lb ON lb.lesson_id = l_fe.id AND lb.type = 'quiz'
       WHERE cs_fe.course_id = c.id AND cs_fe.is_final_exam = TRUE
       ORDER BY l_fe.sort_order ASC, lb.sort_order ASC
       LIMIT 1
     ) final_exam ON TRUE
     LEFT JOIN block_progress bp_exam
       ON bp_exam.enrollment_id = e.id AND bp_exam.block_id = final_exam.block_id
     WHERE e.student_id = $1
       AND e.status = 'active'
       AND (e.expires_at IS NULL OR e.expires_at > NOW())
       AND c.status = 'published'
     GROUP BY e.id, c.id
     ORDER BY e.enrolled_at DESC`,
    [studentId],
  );

  return rows.map((row) => {
    const lessonsCount = Number(row.lessons_count);
    const completedLessons = Number(row.completed_lessons);
    const progressPercent =
      lessonsCount > 0 ? Math.round((completedLessons / lessonsCount) * 100) : 0;
    const completed = resolveEnrollmentCompletion({
      deliveryMode: row.delivery_mode,
      completedAt: row.completed_at,
      lessonsCount,
      completedLessons,
      hasFinalExam: row.has_final_exam,
      finalExamPassed: row.final_exam_passed,
    });
    const canDownloadDc3 = completed && row.enrolled_via_company;

    return {
      enrollmentId: row.enrollment_id,
      courseId: row.course_id,
      title: row.title,
      slug: row.slug,
      shortDescription: row.short_description,
      coverImage: row.cover_image,
      modality: row.modality,
      lessonsCount,
      completedLessons,
      progressPercent,
      canDownloadCertificate: completed,
      canDownloadDc3,
      deliveryMode: row.delivery_mode,
      completed,
      enrolledAt: row.enrolled_at.toISOString(),
    };
  });
}

export async function findCourseEnrollments(
  courseId: string,
): Promise<CourseEnrollmentListItem[]> {
  const { rows } = await pool.query<{
    id: string;
    student_id: string;
    student_name: string;
    student_email: string;
    course_slug: string;
    status: CourseEnrollmentListItem["status"];
    enrolled_at: Date;
    enrolled_via_company: boolean;
    delivery_mode: EnrollmentDeliveryMode;
    completed_at: Date | null;
    dc3_template_url: string | null;
    course_period: string | null;
    certificate_number: string | null;
    lessons_count: string;
    completed_lessons: string;
    has_final_exam: boolean;
    final_exam_passed: boolean | null;
  }>(
    `SELECT e.id,
            e.student_id,
            s.name AS student_name,
            s.email AS student_email,
            c.slug AS course_slug,
            e.status,
            e.enrolled_at,
            e.enrolled_via_company,
            e.delivery_mode,
            e.completed_at,
            c.dc3_template_url,
            c.period AS course_period,
            ep.certificate_number,
            COUNT(DISTINCT l.id)::text AS lessons_count,
            COUNT(DISTINCT lp.lesson_id) FILTER (WHERE lp.completed = TRUE)::text AS completed_lessons,
            BOOL_OR(final_exam.block_id IS NOT NULL) AS has_final_exam,
            BOOL_OR(bp_exam.passed) FILTER (WHERE final_exam.block_id IS NOT NULL) AS final_exam_passed
     FROM enrollments e
     INNER JOIN students s ON s.id = e.student_id
     INNER JOIN courses c ON c.id = e.course_id
     LEFT JOIN enrollment_progress ep ON ep.enrollment_id = e.id
     LEFT JOIN course_sections cs ON cs.course_id = c.id
     LEFT JOIN lessons l ON l.section_id = cs.id
     LEFT JOIN lesson_progress lp ON lp.enrollment_id = e.id AND lp.lesson_id = l.id
     LEFT JOIN LATERAL (
       SELECT lb.id AS block_id
       FROM course_sections cs_fe
       INNER JOIN lessons l_fe ON l_fe.section_id = cs_fe.id
       INNER JOIN lesson_blocks lb ON lb.lesson_id = l_fe.id AND lb.type = 'quiz'
       WHERE cs_fe.course_id = c.id AND cs_fe.is_final_exam = TRUE
       ORDER BY l_fe.sort_order ASC, lb.sort_order ASC
       LIMIT 1
     ) final_exam ON TRUE
     LEFT JOIN block_progress bp_exam
       ON bp_exam.enrollment_id = e.id AND bp_exam.block_id = final_exam.block_id
     WHERE e.course_id = $1
       AND e.status = 'active'
     GROUP BY e.id, s.id, c.id, ep.certificate_number
     ORDER BY e.enrolled_at DESC`,
    [courseId],
  );

  const formatShortDate = (date: Date) =>
    new Intl.DateTimeFormat("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);

  return rows.map((row) => {
    const lessonsCount = Number(row.lessons_count);
    const completedLessons = Number(row.completed_lessons);
    const completed = resolveEnrollmentCompletion({
      deliveryMode: row.delivery_mode,
      completedAt: row.completed_at,
      lessonsCount,
      completedLessons,
      hasFinalExam: row.has_final_exam,
      finalExamPassed: row.final_exam_passed,
    });
    const progressPercent =
      row.delivery_mode === "presencial"
        ? completed
          ? 100
          : 0
        : lessonsCount > 0
          ? Math.round((completedLessons / lessonsCount) * 100)
          : 0;

    let periodLabel = row.course_period?.trim() || "—";
    if (row.enrolled_at && row.completed_at) {
      periodLabel = `${formatShortDate(row.enrolled_at)} – ${formatShortDate(row.completed_at)}`;
    } else if (row.delivery_mode === "online" && row.enrolled_at && !row.completed_at) {
      periodLabel = `Desde ${formatShortDate(row.enrolled_at)}`;
    }

    return {
      id: row.id,
      studentId: row.student_id,
      studentName: row.student_name,
      studentEmail: row.student_email,
      courseSlug: row.course_slug,
      status: row.status,
      enrolledAt: row.enrolled_at.toISOString(),
      enrolledViaCompany: row.enrolled_via_company,
      deliveryMode: row.delivery_mode,
      completedAt: row.completed_at?.toISOString() ?? null,
      completed,
      progressPercent,
      canDownloadCertificate: completed,
      canDownloadDc3: completed && row.enrolled_via_company,
      certificateNumber: row.certificate_number,
      periodLabel,
    };
  });
}

export async function upsertPresencialEnrollment(input: {
  studentId: string;
  courseId: string;
  startedAt: Date;
  endedAt: Date;
  enrolledViaCompany?: boolean;
}): Promise<{ enrollmentId: string; studentId: string; courseId: string }> {
  const { rows: courseRows } = await pool.query<{ id: string; status: string }>(
    "SELECT id, status FROM courses WHERE id = $1 LIMIT 1",
    [input.courseId],
  );
  const course = courseRows[0];
  if (!course) {
    throw new Error("COURSE_NOT_FOUND");
  }
  if (course.status !== "published") {
    throw new Error("COURSE_NOT_PUBLISHED");
  }

  const { rows: existingRows } = await pool.query<{ id: string }>(
    "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 LIMIT 1",
    [input.studentId, input.courseId],
  );
  const existing = existingRows[0];
  const enrolledViaCompany = input.enrolledViaCompany ?? false;

  if (existing) {
    await pool.query(
      `UPDATE enrollments
       SET status = 'active',
           enrolled_at = $2,
           enrolled_via_company = $3,
           delivery_mode = 'presencial',
           completed_at = $4,
           updated_at = NOW()
       WHERE id = $1`,
      [existing.id, input.startedAt, enrolledViaCompany, input.endedAt],
    );
    return {
      enrollmentId: existing.id,
      studentId: input.studentId,
      courseId: input.courseId,
    };
  }

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO enrollments (
       student_id, course_id, status, enrolled_via_company, delivery_mode, enrolled_at, completed_at
     ) VALUES ($1, $2, 'active', $3, 'presencial', $4, $5)
     RETURNING id`,
    [input.studentId, input.courseId, enrolledViaCompany, input.startedAt, input.endedAt],
  );

  return {
    enrollmentId: rows[0].id,
    studentId: input.studentId,
    courseId: input.courseId,
  };
}

export async function markEnrollmentCompleted(
  enrollmentId: string,
  options: { courseId?: string; studentId?: string } = {},
): Promise<{ studentId: string; courseId: string; justCompleted: boolean }> {
  const conditions = ["id = $1", "status = 'active'"];
  const values: unknown[] = [enrollmentId];

  if (options.courseId) {
    values.push(options.courseId);
    conditions.push(`course_id = $${values.length}`);
  }
  if (options.studentId) {
    values.push(options.studentId);
    conditions.push(`student_id = $${values.length}`);
  }

  const { rows } = await pool.query<{
    student_id: string;
    course_id: string;
    just_completed: boolean;
  }>(
    `UPDATE enrollments e
     SET completed_at = COALESCE(e.completed_at, NOW()), updated_at = NOW()
     FROM (
       SELECT id, student_id, course_id, (completed_at IS NULL) AS just_completed
       FROM enrollments
       WHERE ${conditions.join(" AND ")}
     ) prev
     WHERE e.id = prev.id
     RETURNING prev.student_id, prev.course_id, prev.just_completed`,
    values,
  );

  const updated = rows[0];
  if (!updated) {
    throw new Error("ENROLLMENT_NOT_FOUND");
  }

  return {
    studentId: updated.student_id,
    courseId: updated.course_id,
    justCompleted: updated.just_completed,
  };
}

export async function findEnrollmentNotificationContext(enrollmentId: string): Promise<{
  enrollmentId: string;
  enrolledViaCompany: boolean;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
} | null> {
  const { rows } = await pool.query<{
    enrollment_id: string;
    enrolled_via_company: boolean;
    student_name: string;
    student_email: string;
    course_id: string;
    course_title: string;
    course_slug: string;
  }>(
    `SELECT e.id AS enrollment_id,
            e.enrolled_via_company,
            COALESCE(
              NULLIF(TRIM(CONCAT_WS(' ', s.first_names, s.paternal_last_name, s.maternal_last_name)), ''),
              s.name
            ) AS student_name,
            s.email AS student_email,
            c.id AS course_id,
            c.title AS course_title,
            c.slug AS course_slug
     FROM enrollments e
     INNER JOIN students s ON s.id = e.student_id
     INNER JOIN courses c ON c.id = e.course_id
     WHERE e.id = $1
     LIMIT 1`,
    [enrollmentId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    enrollmentId: row.enrollment_id,
    enrolledViaCompany: row.enrolled_via_company,
    studentName: row.student_name,
    studentEmail: row.student_email,
    courseId: row.course_id,
    courseTitle: row.course_title,
    courseSlug: row.course_slug,
  };
}

export async function findActiveEnrolledStudents(excludeCourseId?: string): Promise<
  { id: string; name: string; email: string }[]
> {
  const params: unknown[] = [];
  let excludeFilter = "";
  if (excludeCourseId) {
    params.push(excludeCourseId);
    excludeFilter = `AND NOT EXISTS (
      SELECT 1
      FROM enrollments enrolled
      WHERE enrolled.student_id = s.id
        AND enrolled.course_id = $1
        AND enrolled.status = 'active'
    )`;
  }

  const { rows } = await pool.query<{ id: string; name: string; email: string }>(
    `SELECT DISTINCT s.id, s.name, s.email
     FROM students s
     INNER JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
     WHERE s.active = TRUE
       ${excludeFilter}
     ORDER BY s.name ASC`,
    params,
  );

  return rows;
}

export async function findActiveEnrollmentCourseId(
  studentId: string,
  slug: string,
): Promise<string | null> {
  const { rows } = await pool.query<{ course_id: string }>(
    `SELECT e.course_id
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

  return rows[0]?.course_id ?? null;
}

export async function acceptStudentPrivacy(id: string): Promise<StudentRecord | null> {
  const { rows } = await pool.query<StudentRecord>(
    `UPDATE students
     SET privacy_accepted_at = COALESCE(privacy_accepted_at, NOW()),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  return rows[0] ?? null;
}
