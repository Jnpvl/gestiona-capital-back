import { FIELD_LABELS, type FieldError } from "./field-errors";

interface PgError {
  code?: string;
  table?: string;
  column?: string;
  constraint?: string;
  detail?: string;
}

const ENTITY: Record<string, string> = {
  companies: "una empresa",
  students: "un alumno",
  staff: "un usuario",
  courses: "un curso",
  enrollments: "una inscripción",
  events: "un evento",
  newsletter_subscribers: "una suscripción",
  form_responses: "una respuesta",
  employee_guia5_data: "un registro de Guía V",
};

const COLUMN_FIELD: Record<string, string> = {
  name_normalized: "name",
  email: "email",
  curp: "curp",
  rfc: "rfc",
  slug: "slug",
  company_id: "companyId",
  student_id: "studentId",
  course_id: "courseId",
  instructor_id: "instructorId",
};

function isPgError(e: unknown): e is PgError {
  return typeof e === "object" && e !== null && typeof (e as PgError).code === "string"
    && /^[0-9A-Z]{5}$/.test((e as PgError).code as string);
}

function columnsFromDetail(detail?: string): string[] {
  const m = detail?.match(/Key \(([^)]+)\)/);
  if (!m) return [];
  return m[1].split(",").map((c) => c.trim().replace(/^lower\(|\)$/g, ""));
}

function toField(col: string) {
  const field = COLUMN_FIELD[col] ?? col.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  return { field, label: FIELD_LABELS[field] ?? col };
}

/** Traduce errores de PostgreSQL a mensajes claros. Devuelve null si no aplica. */
export function mapDbError(
  error: unknown,
): { status: number; message: string; code: string; fields: FieldError[] } | null {
  if (!isPgError(error)) return null;
  const entity = ENTITY[error.table ?? ""] ?? "un registro";
  const cols = columnsFromDetail(error.detail);
  switch (error.code) {
    case "23505": {
      const fields = (cols.length ? cols : ["registro"]).map(toField);
      const what = fields
        .map((f) => (f.label === f.label.toUpperCase() ? f.label : f.label.toLowerCase()))
        .join(" y ");
      const message = cols.length ? `Ya existe ${entity} con ese ${what}` : `Ya existe ${entity} con esos datos`;
      return {
        status: 409,
        code: "DUPLICATE",
        message,
        fields: fields.map((f) => ({ ...f, message: "ya está registrado" })),
      };
    }
    case "23503": {
      const fields = cols.map(toField);
      const what = fields.map((f) => f.label).join(", ") || "referencia";
      const message = /is still referenced/.test(error.detail ?? "")
        ? `No se puede eliminar: ${entity.replace(/^un[a]? /, "el registro de ")} está en uso`
        : `${what}: no existe o fue eliminado`;
      return {
        status: 409,
        code: "FOREIGN_KEY",
        message,
        fields: fields.map((f) => ({ ...f, message: "no existe" })),
      };
    }
    case "23502": {
      const f = toField(error.column ?? "campo");
      return { status: 400, code: "REQUIRED", message: `${f.label}: es obligatorio`, fields: [{ ...f, message: "es obligatorio" }] };
    }
    case "22001":
      return { status: 400, code: "TOO_LONG", message: "Uno de los campos excede el largo permitido", fields: [] };
    case "22P02":
      return { status: 400, code: "INVALID_VALUE", message: "Uno de los valores tiene un formato inválido (por ejemplo, un identificador)", fields: [] };
    case "23514":
      return { status: 400, code: "CHECK", message: `Valor no permitido (${error.constraint ?? "regla de la base de datos"})`, fields: [] };
    default:
      return null;
  }
}
