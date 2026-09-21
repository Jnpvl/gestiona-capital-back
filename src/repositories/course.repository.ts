import { pool } from "../config/database";
import { findStaffProfileById } from "./staff.repository";
import { slugify } from "../shared/utils/slug";
import type {
  CourseDetail,
  CourseListItem,
  CourseObjectives,
  CourseParticipantProfile,
  CoursePublicCard,
  CoursePublicDetail,
  CourseRecord,
  CourseSection,
  CourseSyllabusUnit,
  CreateCourseInput,
  Lesson,
  ListCoursesFilters,
  PaginatedCoursesResult,
  SectionInput,
  UpdateCoursePromotionInput,
} from "../types/course.types";
import {
  EMPTY_OBJECTIVES,
  EMPTY_PARTICIPANT_PROFILE,
} from "../types/course.types";

function mapHighlights(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function mapParticipantProfile(value: unknown): CourseParticipantProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_PARTICIPANT_PROFILE };
  }
  const raw = value as Record<string, unknown>;
  return {
    psychographics: typeof raw.psychographics === "string" ? raw.psychographics : "",
    knowledge: typeof raw.knowledge === "string" ? raw.knowledge : "",
    skills: typeof raw.skills === "string" ? raw.skills : "",
  };
}

function mapObjectives(value: unknown): CourseObjectives {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_OBJECTIVES, items: [] };
  }
  const raw = value as Record<string, unknown>;
  const itemsRaw = Array.isArray(raw.items) ? raw.items : [];
  return {
    general: typeof raw.general === "string" ? raw.general : "",
    items: itemsRaw
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map((item) => ({
        label: typeof item.label === "string" ? item.label : "",
        text: typeof item.text === "string" ? item.text : "",
      }))
      .filter((item) => item.text.trim().length > 0),
  };
}

function mapSyllabus(value: unknown): CourseSyllabusUnit[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      title: typeof item.title === "string" ? item.title : "",
      topics: Array.isArray(item.topics)
        ? item.topics.filter((topic): topic is string => typeof topic === "string")
        : [],
    }))
    .filter((item) => item.title.trim().length > 0);
}

function mapCourseRecord(row: CourseRecord): CourseRecord {
  return {
    ...row,
    highlights: mapHighlights(row.highlights),
    participant_profile: mapParticipantProfile(row.participant_profile),
    objectives: mapObjectives(row.objectives),
    syllabus: mapSyllabus(row.syllabus),
  };
}

function mapListItem(row: CourseRecord & { lessons_count: string; students_count: string }): CourseListItem {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    coverImage: row.cover_image,
    modality: row.modality,
    status: row.status,
    showInCatalog: row.show_in_catalog,
    featured: row.featured,
    lessonsCount: Number(row.lessons_count),
    studentsCount: Number(row.students_count),
    createdAt: row.created_at.toISOString(),
  };
}

function mapPublicCard(row: CourseRecord): CoursePublicCard {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    coverImage: row.cover_image,
    modality: row.modality,
    duration: row.duration,
    level: row.level,
    featured: row.featured,
  };
}

async function findSectionsWithLessonsAndBlocks(courseId: string): Promise<CourseSection[]> {
  const { rows: sections } = await pool.query<{
    id: string;
    title: string;
    sort_order: number;
    is_final_exam: boolean;
  }>(
    `SELECT id, title, sort_order, is_final_exam
     FROM course_sections WHERE course_id = $1 ORDER BY sort_order ASC`,
    [courseId],
  );

  if (sections.length === 0) return [];

  const sectionIds = sections.map((section) => section.id);
  const { rows: lessons } = await pool.query<{
    id: string;
    section_id: string;
    title: string;
    sort_order: number;
  }>(
    `SELECT id, section_id, title, sort_order
     FROM lessons WHERE section_id = ANY($1::uuid[])
     ORDER BY sort_order ASC`,
    [sectionIds],
  );

  if (lessons.length === 0) {
    return sections.map((section) => ({
      id: section.id,
      title: section.title,
      sortOrder: section.sort_order,
      isFinalExam: section.is_final_exam,
      lessons: [],
    }));
  }

  const lessonIds = lessons.map((lesson) => lesson.id);
  const { rows: blocks } = await pool.query<{
    id: string;
    lesson_id: string;
    type: Lesson["blocks"][0]["type"];
    title: string | null;
    content: string | null;
    resource_url: string | null;
    sort_order: number;
  }>(
    `SELECT id, lesson_id, type, title, content, resource_url, sort_order
     FROM lesson_blocks WHERE lesson_id = ANY($1::uuid[])
     ORDER BY sort_order ASC`,
    [lessonIds],
  );

  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    sortOrder: section.sort_order,
    isFinalExam: section.is_final_exam,
    lessons: lessons
      .filter((lesson) => lesson.section_id === section.id)
      .map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        sortOrder: lesson.sort_order,
        blocks: blocks
          .filter((block) => block.lesson_id === lesson.id)
          .map((block) => ({
            id: block.id,
            type: block.type,
            title: block.title,
            content: block.content,
            resourceUrl: block.resource_url,
            sortOrder: block.sort_order,
          })),
      })),
  }));
}

async function mapCourseDetail(row: CourseRecord, sections: CourseSection[]): Promise<CourseDetail> {
  const instructorProfile = row.instructor_id
    ? await findStaffProfileById(row.instructor_id)
    : null;

  let stpsThematicAreaName: string | null = null;
  if (row.stps_thematic_area_code) {
    const { rows: areaRows } = await pool.query<{ name: string }>(
      "SELECT name FROM stps_thematic_areas WHERE code = $1 LIMIT 1",
      [row.stps_thematic_area_code],
    );
    stpsThematicAreaName = areaRows[0]?.name ?? null;
  }

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    shortDescription: row.short_description,
    coverImage: row.cover_image,
    modality: row.modality as CourseDetail["modality"],
    duration: row.duration,
    level: row.level,
    highlights: row.highlights,
    participantProfile: row.participant_profile,
    objectives: row.objectives,
    syllabus: row.syllabus,
    status: row.status,
    showInCatalog: row.show_in_catalog,
    featured: row.featured,
    certificateTemplateUrl: row.certificate_template_url,
    dc3TemplateUrl: row.dc3_template_url,
    instructorId: row.instructor_id ?? null,
    location: row.location ?? null,
    period: row.period ?? null,
    stpsThematicAreaCode: row.stps_thematic_area_code ?? null,
    stpsThematicAreaName,
    instructor: instructorProfile
      ? {
          id: instructorProfile.id,
          name: instructorProfile.name,
          career: instructorProfile.career,
          professionalArea: instructorProfile.professionalArea,
          aceStpsRegistration: instructorProfile.aceStpsRegistration,
          renapConocer: instructorProfile.renapConocer,
          professionalLicense: instructorProfile.professionalLicense,
          photoUrl: instructorProfile.photoUrl,
          logoUrl: instructorProfile.logoUrl,
          signatureUrl: instructorProfile.signatureUrl,
        }
      : null,
    sections,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findCoursesPaginated(
  filters: ListCoursesFilters = {},
): Promise<PaginatedCoursesResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`c.status = $${values.length}`);
  }

  if (filters.instructorId) {
    values.push(filters.instructorId);
    conditions.push(`c.instructor_id = $${values.length}`);
  }

  if (filters.search) {
    values.push(`%${filters.search.toLowerCase()}%`);
    const index = values.length;
    conditions.push(`(LOWER(c.title) LIKE $${index} OR LOWER(c.slug) LIKE $${index})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM courses c ${where}`,
    values,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  const listValues = [...values, limit, offset];
  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;

  const { rows } = await pool.query<CourseRecord & { lessons_count: string; students_count: string }>(
    `SELECT c.*,
            COUNT(DISTINCT l.id)::text AS lessons_count,
            (SELECT COUNT(*)::text
             FROM enrollments e
             WHERE e.course_id = c.id AND e.status = 'active') AS students_count
     FROM courses c
     LEFT JOIN course_sections cs ON cs.course_id = c.id
     LEFT JOIN lessons l ON l.section_id = cs.id
     ${where}
     GROUP BY c.id
     ORDER BY c.created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    listValues,
  );

  return {
    courses: rows.map((row) =>
      mapListItem({
        ...mapCourseRecord(row),
        lessons_count: row.lessons_count,
        students_count: row.students_count,
      }),
    ),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function findPublishedCatalog(): Promise<CoursePublicCard[]> {
  const { rows } = await pool.query<CourseRecord>(
    `SELECT * FROM courses
     WHERE status = 'published' AND show_in_catalog = TRUE
     ORDER BY created_at DESC`,
  );
  return rows.map((row) => mapPublicCard(mapCourseRecord(row)));
}

export async function findFeaturedCourses(limit = 3): Promise<CoursePublicCard[]> {
  const { rows } = await pool.query<CourseRecord>(
    `SELECT * FROM courses
     WHERE status = 'published' AND show_in_catalog = TRUE
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((row) => mapPublicCard(mapCourseRecord(row)));
}

export async function findCourseBySlugPublic(slug: string): Promise<CoursePublicDetail | null> {
  const { rows } = await pool.query<CourseRecord>(
    `SELECT * FROM courses
     WHERE slug = $1 AND status = 'published' AND show_in_catalog = TRUE
     LIMIT 1`,
    [slug],
  );
  const row = rows[0];
  if (!row) return null;

  const course = mapCourseRecord(row);
  return {
    ...mapPublicCard(course),
    description: course.description,
    highlights: course.highlights,
    participantProfile: course.participant_profile,
    objectives: course.objectives,
    syllabus: course.syllabus,
  };
}

export async function findCourseById(id: string): Promise<CourseRecord | null> {
  const { rows } = await pool.query<CourseRecord>(
    "SELECT * FROM courses WHERE id = $1 LIMIT 1",
    [id],
  );
  return rows[0] ? mapCourseRecord(rows[0]) : null;
}

export async function findCourseBySlug(slug: string): Promise<CourseRecord | null> {
  const { rows } = await pool.query<CourseRecord>(
    "SELECT * FROM courses WHERE slug = $1 LIMIT 1",
    [slug],
  );
  return rows[0] ? mapCourseRecord(rows[0]) : null;
}

export async function findCourseDetailById(id: string): Promise<CourseDetail | null> {
  const course = await findCourseById(id);
  if (!course) return null;
  const sections = await findSectionsWithLessonsAndBlocks(id);
  return mapCourseDetail(course, sections);
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let slug = slugify(base) || "curso";
  let suffix = 0;

  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const existing = await findCourseBySlug(candidate);
    if (!existing || existing.id === excludeId) return candidate;
    suffix += 1;
  }
}

export async function createCourse(input: CreateCourseInput): Promise<CourseDetail> {
  const slug = await uniqueSlug(input.slug ?? input.title);
  const { rows } = await pool.query<CourseRecord>(
    `INSERT INTO courses (title, slug, status, instructor_id)
     VALUES ($1, $2, 'draft', $3)
     RETURNING *`,
    [input.title.trim(), slug, input.instructorId ?? null],
  );
  return mapCourseDetail(mapCourseRecord(rows[0]), []);
}

export async function updateCoursePromotion(
  id: string,
  input: UpdateCoursePromotionInput,
): Promise<CourseDetail | null> {
  const current = await findCourseById(id);
  if (!current) return null;

  const slug =
    input.slug !== undefined
      ? await uniqueSlug(input.slug, id)
      : input.title !== undefined && input.title.trim() !== current.title
        ? await uniqueSlug(input.title, id)
        : current.slug;

  const { rows } = await pool.query<CourseRecord>(
    `UPDATE courses SET
       title = $1,
       slug = $2,
       description = $3,
       short_description = $4,
       cover_image = $5,
       modality = $6,
       duration = $7,
       level = $8,
       highlights = $9::jsonb,
       participant_profile = $10::jsonb,
       objectives = $11::jsonb,
       syllabus = $12::jsonb,
       status = $13,
       show_in_catalog = $14,
       featured = $15,
       certificate_template_url = $16,
       dc3_template_url = $17,
       location = $18,
       period = $19,
       instructor_id = $20,
       stps_thematic_area_code = $21,
       updated_at = NOW()
     WHERE id = $22
     RETURNING *`,
    [
      input.title?.trim() ?? current.title,
      slug,
      input.description !== undefined ? input.description : current.description,
      input.shortDescription !== undefined ? input.shortDescription : current.short_description,
      input.coverImage !== undefined ? input.coverImage : current.cover_image,
      input.modality !== undefined ? input.modality : current.modality,
      input.duration !== undefined ? input.duration : current.duration,
      input.level !== undefined ? input.level : current.level,
      JSON.stringify(input.highlights ?? current.highlights),
      JSON.stringify(input.participantProfile ?? current.participant_profile),
      JSON.stringify(input.objectives ?? current.objectives),
      JSON.stringify(input.syllabus ?? current.syllabus),
      input.status ?? current.status,
      input.showInCatalog ?? current.show_in_catalog,
      input.featured ?? current.featured,
      input.certificateTemplateUrl !== undefined
        ? input.certificateTemplateUrl
        : current.certificate_template_url,
      input.dc3TemplateUrl !== undefined ? input.dc3TemplateUrl : current.dc3_template_url,
      input.location !== undefined ? input.location : current.location,
      input.period !== undefined ? input.period : current.period,
      current.instructor_id ?? input.instructorId ?? null,
      input.stpsThematicAreaCode !== undefined
        ? input.stpsThematicAreaCode?.trim() || null
        : current.stps_thematic_area_code,
      id,
    ],
  );

  if (!rows[0]) return null;
  const sections = await findSectionsWithLessonsAndBlocks(id);
  return mapCourseDetail(mapCourseRecord(rows[0]), sections);
}

export async function replaceCourseContent(
  courseId: string,
  sections: SectionInput[],
): Promise<CourseDetail | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const keptSectionIds: string[] = [];

    for (const section of sections) {
      let sectionId = section.id ?? null;

      if (sectionId) {
        const { rows: owned } = await client.query<{ id: string }>(
          `SELECT id FROM course_sections WHERE id = $1 AND course_id = $2`,
          [sectionId, courseId],
        );
        if (!owned[0]) {
          sectionId = null;
        }
      }

      if (sectionId) {
        await client.query(
          `UPDATE course_sections
           SET title = $2, sort_order = $3, is_final_exam = $4, updated_at = NOW()
           WHERE id = $1`,
          [sectionId, section.title.trim(), section.sortOrder, section.isFinalExam ?? false],
        );
      } else {
        const { rows } = await client.query<{ id: string }>(
          section.id
            ? `INSERT INTO course_sections (id, course_id, title, sort_order, is_final_exam)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id`
            : `INSERT INTO course_sections (course_id, title, sort_order, is_final_exam)
               VALUES ($1, $2, $3, $4)
               RETURNING id`,
          section.id
            ? [
                section.id,
                courseId,
                section.title.trim(),
                section.sortOrder,
                section.isFinalExam ?? false,
              ]
            : [courseId, section.title.trim(), section.sortOrder, section.isFinalExam ?? false],
        );
        sectionId = rows[0].id;
      }

      keptSectionIds.push(sectionId);
      const keptLessonIds: string[] = [];

      for (const lesson of section.lessons) {
        let lessonId = lesson.id ?? null;

        if (lessonId) {
          const { rows: owned } = await client.query<{ id: string }>(
            `SELECT l.id
             FROM lessons l
             INNER JOIN course_sections cs ON cs.id = l.section_id
             WHERE l.id = $1 AND cs.course_id = $2`,
            [lessonId, courseId],
          );
          if (!owned[0]) {
            lessonId = null;
          }
        }

        if (lessonId) {
          await client.query(
            `UPDATE lessons
             SET section_id = $2, title = $3, sort_order = $4, updated_at = NOW()
             WHERE id = $1`,
            [lessonId, sectionId, lesson.title.trim(), lesson.sortOrder],
          );
        } else {
          const { rows } = await client.query<{ id: string }>(
            lesson.id
              ? `INSERT INTO lessons (id, section_id, title, sort_order)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id`
              : `INSERT INTO lessons (section_id, title, sort_order)
                 VALUES ($1, $2, $3)
                 RETURNING id`,
            lesson.id
              ? [lesson.id, sectionId, lesson.title.trim(), lesson.sortOrder]
              : [sectionId, lesson.title.trim(), lesson.sortOrder],
          );
          lessonId = rows[0].id;
        }

        keptLessonIds.push(lessonId);
        const keptBlockIds: string[] = [];

        for (const block of lesson.blocks) {
          let blockId = block.id ?? null;

          if (blockId) {
            const { rows: owned } = await client.query<{ id: string }>(
              `SELECT lb.id
               FROM lesson_blocks lb
               INNER JOIN lessons l ON l.id = lb.lesson_id
               INNER JOIN course_sections cs ON cs.id = l.section_id
               WHERE lb.id = $1 AND cs.course_id = $2`,
              [blockId, courseId],
            );
            if (!owned[0]) {
              blockId = null;
            }
          }

          if (blockId) {
            await client.query(
              `UPDATE lesson_blocks
               SET lesson_id = $2, type = $3, title = $4, content = $5,
                   resource_url = $6, sort_order = $7, updated_at = NOW()
               WHERE id = $1`,
              [
                blockId,
                lessonId,
                block.type,
                block.title?.trim() || null,
                block.content || null,
                block.resourceUrl || null,
                block.sortOrder,
              ],
            );
          } else {
            const { rows } = await client.query<{ id: string }>(
              block.id
                ? `INSERT INTO lesson_blocks
                     (id, lesson_id, type, title, content, resource_url, sort_order)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   RETURNING id`
                : `INSERT INTO lesson_blocks
                     (lesson_id, type, title, content, resource_url, sort_order)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   RETURNING id`,
              block.id
                ? [
                    block.id,
                    lessonId,
                    block.type,
                    block.title?.trim() || null,
                    block.content || null,
                    block.resourceUrl || null,
                    block.sortOrder,
                  ]
                : [
                    lessonId,
                    block.type,
                    block.title?.trim() || null,
                    block.content || null,
                    block.resourceUrl || null,
                    block.sortOrder,
                  ],
            );
            blockId = rows[0].id;
          }

          keptBlockIds.push(blockId);
        }

        if (keptBlockIds.length > 0) {
          await client.query(
            `DELETE FROM lesson_blocks
             WHERE lesson_id = $1 AND NOT (id = ANY($2::uuid[]))`,
            [lessonId, keptBlockIds],
          );
        } else {
          await client.query(`DELETE FROM lesson_blocks WHERE lesson_id = $1`, [lessonId]);
        }
      }

      if (keptLessonIds.length > 0) {
        await client.query(
          `DELETE FROM lessons
           WHERE section_id = $1 AND NOT (id = ANY($2::uuid[]))`,
          [sectionId, keptLessonIds],
        );
      } else {
        await client.query(`DELETE FROM lessons WHERE section_id = $1`, [sectionId]);
      }
    }

    if (keptSectionIds.length > 0) {
      await client.query(
        `DELETE FROM course_sections
         WHERE course_id = $1 AND NOT (id = ANY($2::uuid[]))`,
        [courseId, keptSectionIds],
      );
    } else {
      await client.query(`DELETE FROM course_sections WHERE course_id = $1`, [courseId]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return findCourseDetailById(courseId);
}
