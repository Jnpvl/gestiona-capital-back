import { z } from "zod";

export const psychologistInputSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(255),
  license: z.string().trim().min(1, "La cédula es obligatoria").max(100),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z
    .union([z.literal(""), z.string().trim().email("Correo inválido").max(255)])
    .optional()
    .nullable(),
  address: z.string().trim().max(2000).optional().nullable(),
});

export const referralSessionSchema = z.object({
  psychologistId: z.string().uuid(),
  datetime: z.string().min(1, "La fecha y hora son obligatorias"),
  status: z.enum(["Programada", "Realizada", "Cancelada"]),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const saveReferralSchema = z.object({
  status: z.string().trim().min(1).max(50),
  sessions: z.array(referralSessionSchema).default([]),
  closure: z
    .object({
      psychologistId: z.string().uuid().nullable().optional(),
      conclusion: z.string().trim().max(5000).optional().nullable(),
      recommendations: z.string().trim().max(5000).optional().nullable(),
      resolution: z.enum(["Alta", "Seguimiento"]).nullable().optional(),
    })
    .optional()
    .nullable(),
});

export const referralYearQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
