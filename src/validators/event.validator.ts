import { z } from "zod";

export const createEventSchema = z.object({
  title: z.string().trim().min(2, "El título es obligatorio"),
  eventType: z.string().trim().min(1, "El tipo es obligatorio"),
  modality: z.string().trim().min(1, "La modalidad es obligatoria"),
  dateLabel: z.string().trim().min(1, "La fecha es obligatoria"),
  description: z.string().trim().min(10, "La descripción es obligatoria"),
  status: z.enum(["draft", "published"]).optional().default("draft"),
  isVisible: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const updateEventSchema = z.object({
  title: z.string().trim().min(2).optional(),
  eventType: z.string().trim().min(1).optional(),
  modality: z.string().trim().min(1).optional(),
  dateLabel: z.string().trim().min(1).optional(),
  description: z.string().trim().min(10).optional(),
  status: z.enum(["draft", "published"]).optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const listEventsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreateEventBody = z.infer<typeof createEventSchema>;
export type UpdateEventBody = z.infer<typeof updateEventSchema>;
