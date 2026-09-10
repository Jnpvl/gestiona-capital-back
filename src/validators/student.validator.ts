import { z } from "zod";
import { alumnoTypeSchema } from "./alumno-type.validator";

const curpSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/,
    "CURP inválida (18 caracteres en formato oficial)",
  );

export const genderSchema = z.enum(["masculino", "femenino", "otro"], {
  message: "Selecciona el sexo",
});

export const educationLevelSchema = z.enum([
  "sin_formacion",
  "primaria",
  "secundaria",
  "preparatoria",
  "tecnico_superior",
  "licenciatura",
  "maestria",
  "doctorado",
]);

export const jobTypeSchema = z.enum([
  "operativo",
  "profesional_tecnico",
  "supervisor",
  "gerente",
  "otro",
]);

const namePartSchema = z.string().trim().min(1, "Campo obligatorio");

const optionalProfileFields = {
  educationLevel: educationLevelSchema.optional().nullable(),
  professionArea: z.string().trim().optional().nullable(),
  educationInstitution: z.string().trim().optional().nullable(),
  currentlyEmployed: z.boolean().optional().nullable(),
  jobType: jobTypeSchema.optional().nullable(),
  currentPosition: z.string().trim().optional().nullable(),
  industrySector: z.string().trim().optional().nullable(),
  yearsExperience: z.coerce.number().int().min(0).max(80).optional().nullable(),
  timeInCurrentPosition: z.string().trim().optional().nullable(),
  stpsOccupationCode: z.string().optional().nullable(),
  stpsThematicAreaCode: z.string().optional().nullable(),
  companyId: z.string().uuid("Empresa inválida").optional().nullable(),
};

export const createStudentSchema = z.object({
  paternalLastName: namePartSchema,
  maternalLastName: z.string().trim().optional().nullable(),
  firstNames: namePartSchema,
  email: z.string().trim().email("Correo inválido"),
  password: z.string().trim().min(6, "La contraseña debe tener al menos 6 caracteres"),
  phone: z.string().trim().min(7, "El teléfono es obligatorio"),
  notes: z.string().trim().optional().nullable(),
  alumnoType: alumnoTypeSchema,
  curp: curpSchema,
  gender: genderSchema,
  age: z.coerce.number().int().min(1, "La edad es obligatoria").max(120),
  residenceLocation: z.string().trim().min(2, "Indica ciudad o estado de residencia"),
  ...optionalProfileFields,
  active: z.boolean().optional(),
});

export const updateStudentSchema = z.object({
  paternalLastName: namePartSchema.optional(),
  maternalLastName: z.string().trim().optional().nullable(),
  firstNames: namePartSchema.optional(),
  email: z.string().trim().email().optional(),
  password: z.string().trim().min(6).optional(),
  sendAccessEmail: z.boolean().optional(),
  phone: z.string().trim().min(7).optional(),
  notes: z.string().trim().nullable().optional(),
  alumnoType: alumnoTypeSchema.optional(),
  curp: curpSchema.optional(),
  gender: genderSchema.optional(),
  age: z.coerce.number().int().min(1).max(120).optional(),
  residenceLocation: z.string().trim().min(2).optional(),
  ...optionalProfileFields,
  active: z.boolean().optional(),
});

export const sendStudentAccessSchema = z.object({
  password: z.string().trim().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const updateStudentStatusSchema = z.object({
  active: z.boolean(),
});

export const listStudentsQuerySchema = z.object({
  search: z.string().optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  alumnoType: alumnoTypeSchema.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const assignCourseSchema = z.object({
  courseId: z.string().uuid("Curso inválido"),
  enrolledViaCompany: z.boolean().optional().default(false),
  deliveryMode: z.enum(["online", "presencial"]).optional().default("online"),
});
