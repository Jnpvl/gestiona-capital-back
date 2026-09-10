import { z } from "zod";

export const staffLoginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().trim().min(1, "La contraseña es obligatoria"),
});

export const studentLoginSchema = staffLoginSchema;
