import { z } from "zod";

export const alumnoTypeSchema = z.enum(["estudiante", "particular", "trabajador"], {
  message: "Selecciona un tipo de alumno",
});
