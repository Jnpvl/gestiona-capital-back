import { z } from "zod";

export const createCourseSchema = z.object({
  title: z.string().min(2, "El título es obligatorio"),
  slug: z.string().optional(),
  instructorId: z.string().uuid().nullable().optional(),
});

const participantProfileSchema = z.object({
  psychographics: z.string().optional().default(""),
  knowledge: z.string().optional().default(""),
  skills: z.string().optional().default(""),
});

const objectiveItemSchema = z.object({
  label: z.string().optional().default(""),
  text: z.string().min(1),
});

const objectivesSchema = z.object({
  general: z.string().optional().default(""),
  items: z.array(objectiveItemSchema).optional().default([]),
});

const syllabusUnitSchema = z.object({
  title: z.string().min(1),
  topics: z.array(z.string()).optional().default([]),
});

export const updateCoursePromotionSchema = z.object({
  title: z.string().min(2).optional(),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  shortDescription: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  modality: z.enum(["presencial", "online", "hibrido"]).nullable().optional(),
  duration: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  highlights: z.array(z.string()).optional(),
  participantProfile: participantProfileSchema.optional(),
  objectives: objectivesSchema.optional(),
  syllabus: z.array(syllabusUnitSchema).optional(),
  status: z.enum(["draft", "published"]).optional(),
  showInCatalog: z.boolean().optional(),
  featured: z.boolean().optional(),
  certificateTemplateUrl: z.string().nullable().optional(),
  dc3TemplateUrl: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  period: z.string().nullable().optional(),
  stpsThematicAreaCode: z.string().nullable().optional(),
  instructorId: z.string().uuid().nullable().optional(),
});

export const lessonBlockSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["video", "text", "presentation", "quiz", "file", "image", "assignment"]),
  title: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  resourceUrl: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0),
});

export const lessonSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  sortOrder: z.number().int().min(0),
  blocks: z.array(lessonBlockSchema),
});

export const sectionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  sortOrder: z.number().int().min(0),
  isFinalExam: z.boolean().optional().default(false),
  lessons: z.array(lessonSchema),
});

export const updateCourseContentSchema = z.object({
  sections: z.array(sectionSchema),
});

export const listCoursesQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  instructorId: z.string().uuid().optional(),
  unassigned: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) =>
      value === undefined ? undefined : value === "true" || value === "1",
    ),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
