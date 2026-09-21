import { z } from "zod";

export const createSubscriberSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio"),
  email: z.string().trim().email("Correo inválido"),
  company: z.string().trim().optional().nullable(),
});

export const listSubscribersQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "unsubscribed"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const updateSubscriberStatusSchema = z.object({
  status: z.enum(["active", "unsubscribed"]),
});

export type CreateSubscriberInput = z.infer<typeof createSubscriberSchema>;
