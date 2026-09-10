import { z } from "zod";

const companyRfcSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/,
    "RFC inválido (12 caracteres para persona moral o 13 para física)",
  );

const companyProfileFields = {
  name: z.string().trim().min(2, "El nombre o razón social es obligatorio"),
  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .nullable()
    .refine((value) => !value || companyRfcSchema.safeParse(value).success, {
      message: "RFC inválido",
    }),
  employerRepresentative: z.string().trim().optional().nullable(),
  workersRepresentative: z.string().trim().optional().nullable(),
};

export const createCompanySchema = z.object(companyProfileFields);

export const updateCompanySchema = z.object({
  name: z.string().trim().min(2).optional(),
  rfc: companyProfileFields.rfc,
  employerRepresentative: companyProfileFields.employerRepresentative,
  workersRepresentative: companyProfileFields.workersRepresentative,
});

export const listCompaniesQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});
