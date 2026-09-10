import { z } from "zod";

export const contactMessageSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre es obligatorio"),
  empresa: z.string().trim().optional().default(""),
  email: z.string().trim().email("Correo inválido"),
  telefono: z.string().trim().optional().default(""),
  servicio: z.string().trim().optional().default(""),
  mensaje: z.string().trim().min(5, "El mensaje es obligatorio"),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
