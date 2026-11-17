import { z } from "zod";

const companyRfcSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/,
    "formato inválido (ej. ABC123456XYZ; 12 caracteres persona moral, 13 física)",
  );

const companyProfileFields = {
  addressStreet: z.string().trim().max(150, "Calle: máximo 150 caracteres").optional().nullable(),
  addressExteriorNumber: z.string().trim().max(30, "Número exterior: máximo 30 caracteres").optional().nullable(),
  addressInteriorNumber: z.string().trim().max(30, "Número interior: máximo 30 caracteres").optional().nullable(),
  addressNeighborhood: z.string().trim().max(150, "Colonia: máximo 150 caracteres").optional().nullable(),
  addressPostalCode: z.string().trim().regex(/^(?:[0-9]{5})?$/, "El código postal debe tener 5 dígitos").optional().nullable(),
  addressCity: z.string().trim().max(100, "Ciudad o localidad: máximo 100 caracteres").optional().nullable(),
  addressMunicipality: z.string().trim().max(100, "Municipio o alcaldía: máximo 100 caracteres").optional().nullable(),
  addressState: z.string().trim().max(100, "Estado: máximo 100 caracteres").optional().nullable(),
  addressCountry: z.string().trim().max(100, "País: máximo 100 caracteres").optional().nullable(),
  addressBetweenStreet1: z.string().trim().max(150, "Entre calle: máximo 150 caracteres").optional().nullable(),
  addressBetweenStreet2: z.string().trim().max(150, "Y calle: máximo 150 caracteres").optional().nullable(),
  name: z.string().trim().min(2, "El nombre o razón social es obligatorio"),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .refine((value) => !value || companyRfcSchema.safeParse(value).success, {
      message: "formato inválido (ej. ABC123456XYZ; 12 caracteres persona moral, 13 física)",
    }),
  employerRepresentative: z.string().trim().optional().nullable(),
  workersRepresentative: z.string().trim().optional().nullable(),
  workersCount: z.coerce
    .number()
    .int("Debe ser un número entero")
    .min(1, "Debe ser al menos 1")
    .max(1000000)
    .optional()
    .nullable(),
  address: z.string().trim().max(500, "El domicilio no debe superar 500 caracteres").optional().nullable(),
  activityMain: z.string().trim().max(100, "La actividad principal no debe superar 100 caracteres").optional().nullable(),
};

const accessEmailSchema = z.string().trim().toLowerCase().email("no es un correo válido");
const accessPasswordSchema = z.string().trim().min(6, "debe tener al menos 6 caracteres");

export const createCompanySchema = z
  .object({
    ...companyProfileFields,
    accessEmail: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .nullable()
      .refine((v) => !v || accessEmailSchema.safeParse(v).success, { message: "no es un correo válido" }),
    password: z.string().trim().optional().nullable(),
    sendAccessEmail: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.accessEmail && !v.password) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "es obligatoria si capturas correo de acceso" });
    }
    if (v.password && v.password.length < 6) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "debe tener al menos 6 caracteres" });
    }
    if (v.password && !v.accessEmail) {
      ctx.addIssue({ code: "custom", path: ["accessEmail"], message: "es obligatorio si capturas contraseña" });
    }
  });

export const companyAccessSchema = z.object({
  accessEmail: accessEmailSchema,
  password: accessPasswordSchema.optional().nullable(),
  sendAccessEmail: z.boolean().optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().trim().min(2, "debe tener al menos 2 caracteres").optional(),
  rfc: companyProfileFields.rfc,
  employerRepresentative: companyProfileFields.employerRepresentative,
  workersRepresentative: companyProfileFields.workersRepresentative,
  workersCount: companyProfileFields.workersCount,
  activityMain: companyProfileFields.activityMain,
  address: companyProfileFields.address,
  addressStreet: companyProfileFields.addressStreet,
  addressExteriorNumber: companyProfileFields.addressExteriorNumber,
  addressInteriorNumber: companyProfileFields.addressInteriorNumber,
  addressNeighborhood: companyProfileFields.addressNeighborhood,
  addressPostalCode: companyProfileFields.addressPostalCode,
  addressCity: companyProfileFields.addressCity,
  addressMunicipality: companyProfileFields.addressMunicipality,
  addressState: companyProfileFields.addressState,
  addressCountry: companyProfileFields.addressCountry,
  addressBetweenStreet1: companyProfileFields.addressBetweenStreet1,
  addressBetweenStreet2: companyProfileFields.addressBetweenStreet2,
});

export const listCompaniesQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export const companyEmployeeImportRowSchema = z.object({
  curp: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/, "CURP inválida"),
  paternalLastName: z.string().trim().min(1, "Falta apellido paterno"),
  maternalLastName: z.string().trim().nullable(),
  firstNames: z.string().trim().min(1, "Faltan nombre(s)"),
  email: z.string().trim().toLowerCase().email("Correo inválido o vacío"),
  phone: z.string().trim().nullable(),
  currentPosition: z.string().trim().nullable(),
  /** Opcional: código del catálogo STPS (para DC3 / cursos con empresa). */
  stpsOccupationCode: z.string().trim().nullable(),
});

export type CompanyEmployeeImportRow = z.infer<typeof companyEmployeeImportRowSchema>;

export const companyEmployeeImportOptionsSchema = z.object({
  evaluationYear: z.coerce.number().int().min(2000).max(2100).optional(),
  sendWelcomeEmail: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0", "on"])])
    .optional()
    .transform((v) => v === true || v === "true" || v === "1" || v === "on"),
});

export const sendEmployeeAccessSchema = z
  .object({
    studentIds: z.array(z.string().uuid("Empleado inválido")).max(500, "Máximo 500 empleados por envío").optional(),
    all: z.boolean().optional().default(false),
    activateInactive: z.boolean().optional().default(false),
    dryRun: z.boolean().optional().default(false),
  })
  .superRefine((v, ctx) => {
    if (!v.all && (!v.studentIds || v.studentIds.length === 0)) {
      ctx.addIssue({ code: "custom", path: ["studentIds"], message: "Selecciona al menos un empleado" });
    }
  });

/** Asignación masiva de un curso a los empleados de la empresa (siempre con empresa). */
export const assignCompanyCourseSchema = z.object({
  courseId: z.string().uuid("Curso inválido"),
  deliveryMode: z.enum(["online", "presencial"]).default("online"),
});
