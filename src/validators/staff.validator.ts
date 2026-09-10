import { z } from "zod";

const namePartSchema = z.string().trim().min(1, "Campo obligatorio");

const staffGenderSchema = z.enum(["male", "female", "other"]);

const staffProfileFields = {
  paternalLastName: namePartSchema,
  maternalLastName: z.string().trim().optional().nullable(),
  firstNames: namePartSchema,
  age: z.coerce.number().int().min(16).max(120).optional().nullable(),
  gender: staffGenderSchema.optional().nullable(),
  aceStpsRegistration: z.string().trim().optional().nullable(),
  renapConocer: z.string().trim().optional().nullable(),
  professionalLicense: z.string().trim().optional().nullable(),
  photoUrl: z.string().trim().optional().nullable(),
  logoUrl: z.string().trim().optional().nullable(),
  signatureUrl: z.string().trim().optional().nullable(),
  career: z.string().trim().optional().nullable(),
  professionalArea: z.string().trim().optional().nullable(),
  professionalBio: z.string().trim().optional().nullable(),
};

function validateTeacherProfile(
  data: {
    role: "admin" | "teacher";
    aceStpsRegistration?: string | null;
    career?: string | null;
    professionalArea?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (data.role !== "teacher") return;

  if (!data.aceStpsRegistration?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Indica el registro ACE STPS del instructor",
      path: ["aceStpsRegistration"],
    });
  }

  if (!data.career?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Indica la carrera o profesión del instructor",
      path: ["career"],
    });
  }

  if (!data.professionalArea?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Indica el área en la que se desarrolla",
      path: ["professionalArea"],
    });
  }
}

export const createStaffSchema = z
  .object({
    ...staffProfileFields,
    email: z.string().email("Correo inválido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    role: z.enum(["admin", "teacher"]),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => validateTeacherProfile(data, ctx));

export const updateStaffSchema = z
  .object({
    paternalLastName: namePartSchema.optional(),
    maternalLastName: z.string().trim().optional().nullable(),
    firstNames: namePartSchema.optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    role: z.enum(["admin", "teacher"]).optional(),
    age: z.coerce.number().int().min(16).max(120).optional().nullable(),
    gender: staffGenderSchema.optional().nullable(),
    aceStpsRegistration: z.string().trim().optional().nullable(),
    renapConocer: z.string().trim().optional().nullable(),
    professionalLicense: z.string().trim().optional().nullable(),
    photoUrl: z.string().trim().optional().nullable(),
    logoUrl: z.string().trim().optional().nullable(),
    signatureUrl: z.string().trim().optional().nullable(),
    career: z.string().trim().optional().nullable(),
    professionalArea: z.string().trim().optional().nullable(),
    professionalBio: z.string().trim().optional().nullable(),
    active: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role) {
      validateTeacherProfile(
        {
          role: data.role,
          aceStpsRegistration: data.aceStpsRegistration,
          career: data.career,
          professionalArea: data.professionalArea,
        },
        ctx,
      );
    }
  });

export const updateStaffStatusSchema = z.object({
  active: z.boolean(),
});

export const listStaffQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(["admin", "teacher"]).optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
