import { z } from "zod";
import { ASSIGNABLE_FORM_KEYS, FORM_KEYS, type FormKey } from "../shared/forms";

export const formKeySchema = z.enum(FORM_KEYS as [FormKey, ...FormKey[]], {
  message: "Formulario no válido",
});

const evaluationYearSchema = z.coerce
  .number()
  .int("Año de evaluación no válido")
  .min(2000, "Año de evaluación no válido")
  .max(2100, "Año de evaluación no válido");

export const createFormAssignmentSchema = z.object({
  formKeys: z
    .array(
      z.enum(ASSIGNABLE_FORM_KEYS as [FormKey, ...FormKey[]], {
        message: "Formulario no válido o no asignable",
      }),
    )
    .min(1, "Selecciona al menos un formulario")
    .transform((keys) => Array.from(new Set(keys))),
  modes: z
    .record(z.string(), z.enum(["admin_applied", "self"], { message: "Modo no válido" }))
    .optional(),
  evaluationYear: evaluationYearSchema.optional(),
  dueAt: z.coerce.date().optional().nullable(),
});

/** Query ?year=2026 para dashboard / formularios por año de evaluación. */
export function parseEvaluationYearQuery(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const parsed = evaluationYearSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export const formModeSchema = z.object({
  mode: z.enum(["admin_applied", "self"], { message: "Modo no válido" }),
});

export const studentFormSaveSchema = z.object({
  answers: z.record(z.string(), z.unknown()).default({}),
  finalize: z.boolean().optional().default(false),
});
