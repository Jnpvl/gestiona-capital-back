import { z } from "zod";

export const createCourseSchema = z.object({
  title: z.string().min(2, "El título es obligatorio"),
  slug: z.string().optional(),
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
  status: z.enum(["draft", "published"]).optional(),
  showInCatalog: z.boolean().optional(),
  featured: z.boolean().optional(),
  certificateTemplateUrl: z.string().nullable().optional(),
  dc3TemplateUrl: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  period: z.string().nullable().optional(),
  stpsThematicAreaCode: z.string().nullable().optional(),
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
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
