import { z, type ZodError } from "zod";

/** Etiquetas legibles para los campos que validan los esquemas (toda la API). */
export const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  nombre: "Nombre",
  rfc: "RFC",
  curp: "CURP",
  email: "Correo",
  password: "Contraseña",
  phone: "Teléfono",
  telefono: "Teléfono",
  firstNames: "Nombre(s)",
  paternalLastName: "Apellido paterno",
  maternalLastName: "Apellido materno",
  gender: "Sexo",
  age: "Edad",
  role: "Rol",
  active: "Activo",
  company: "Empresa",
  empresa: "Empresa",
  companyId: "Empresa",
  employerRepresentative: "Representante del patrón",
  workersRepresentative: "Representante de los trabajadores",
  workersCount: "Número de trabajadores",
  alumnoType: "Tipo de alumno",
  currentPosition: "Puesto",
  currentlyEmployed: "Actualmente empleado",
  residenceLocation: "Lugar de residencia",
  educationLevel: "Nivel de estudios",
  educationInstitution: "Institución educativa",
  career: "Carrera",
  professionalArea: "Área profesional",
  professionArea: "Área de profesión",
  professionalBio: "Semblanza profesional",
  professionalLicense: "Cédula profesional",
  renapConocer: "Registro RENAP/CONOCER",
  aceStpsRegistration: "Registro ACE STPS",
  stpsOccupationCode: "Código de ocupación STPS",
  stpsThematicAreaCode: "Área temática STPS",
  industrySector: "Sector",
  jobType: "Tipo de puesto",
  timeInCurrentPosition: "Tiempo en el puesto",
  yearsExperience: "Años de experiencia",
  photoUrl: "Foto",
  logoUrl: "Logo",
  signatureUrl: "Firma",
  sendAccessEmail: "Enviar accesos",
  sendWelcomeEmail: "Enviar correo de bienvenida",
  studentIds: "Empleados",
  activateInactive: "Activar a los inactivos",
  notes: "Notas",
  title: "Título",
  slug: "Slug",
  description: "Descripción",
  shortDescription: "Descripción corta",
  coverImage: "Imagen de portada",
  duration: "Duración",
  level: "Nivel",
  modality: "Modalidad",
  deliveryMode: "Modalidad de impartición",
  instructorId: "Instructor",
  courseId: "Curso",
  lessonId: "Lección",
  blockId: "Bloque",
  certificateTemplateUrl: "Plantilla de constancia",
  objectives: "Objetivos",
  syllabus: "Temario",
  topics: "Temas",
  highlights: "Puntos destacados",
  participantProfile: "Perfil del participante",
  showInCatalog: "Mostrar en catálogo",
  featured: "Destacado",
  isVisible: "Visible",
  isFinalExam: "Examen final",
  sortOrder: "Orden",
  content: "Contenido",
  resourceUrl: "URL del recurso",
  sections: "Secciones",
  lessons: "Lecciones",
  blocks: "Bloques",
  items: "Elementos",
  label: "Etiqueta",
  text: "Texto",
  type: "Tipo",
  status: "Estado",
  eventType: "Tipo de evento",
  dateLabel: "Fecha",
  location: "Lugar",
  period: "Periodo",
  message: "Mensaje",
  mensaje: "Mensaje",
  servicio: "Servicio",
  formKeys: "Formularios",
  dueAt: "Fecha límite",
  answers: "Respuestas",
  score: "Calificación",
  reviewerComment: "Comentario del revisor",
  code: "Código",
  page: "Página",
  limit: "Límite",
  search: "Búsqueda",
};

function humanize(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function labelForPath(path: PropertyKey[]): { field: string; label: string } {
  const field = path.map(String).join(".");
  const named = [...path].reverse().find((p) => typeof p === "string") as string | undefined;
  if (!named) return { field: field || "_", label: "Datos" };
  const base = FIELD_LABELS[named] ?? humanize(named);
  const index = path.find((p) => typeof p === "number");
  return { field, label: index != null ? `${base} (#${Number(index) + 1})` : base };
}

const TYPE_NAMES: Record<string, string> = {
  string: "texto",
  number: "número",
  int: "número entero",
  boolean: "sí/no",
  date: "fecha",
  array: "lista",
  object: "objeto",
};

/** Mensajes en español para errores sin mensaje propio en el esquema. */
z.config({
  customError: (issue) => {
    switch (issue.code) {
      case "invalid_type":
        if (issue.input === undefined || issue.input === null) return "es obligatorio";
        return `debe ser ${TYPE_NAMES[issue.expected] ?? issue.expected}`;
      case "too_small":
        if (issue.origin === "string")
          return Number(issue.minimum) <= 1
            ? "es obligatorio"
            : `debe tener al menos ${issue.minimum} caracteres`;
        if (issue.origin === "array") return `debe tener al menos ${issue.minimum} elemento(s)`;
        return `debe ser mayor o igual a ${issue.minimum}`;
      case "too_big":
        if (issue.origin === "string") return `debe tener máximo ${issue.maximum} caracteres`;
        if (issue.origin === "array") return `debe tener máximo ${issue.maximum} elemento(s)`;
        return `debe ser menor o igual a ${issue.maximum}`;
      case "invalid_format":
        if (issue.format === "email") return "no es un correo válido";
        if (issue.format === "url") return "no es una URL válida";
        if (issue.format === "uuid") return "identificador inválido";
        if (issue.format === "datetime" || issue.format === "date") return "fecha inválida";
        return "formato inválido";
      case "invalid_value":
        return `valor no permitido (opciones: ${issue.values.map(String).join(", ")})`;
      case "unrecognized_keys":
        return `campos no permitidos: ${issue.keys.join(", ")}`;
      case "not_multiple_of":
        return `debe ser múltiplo de ${issue.divisor}`;
      default:
        return "valor inválido";
    }
  },
});

export interface FieldError {
  field: string;
  label: string;
  message: string;
}

function strip(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function zodFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => {
    const { field, label } = labelForPath(issue.path);
    return { field, label, message: issue.message };
  });
}

/** "RFC: formato inválido; Correo: no es un correo válido". */
export function summarizeFieldErrors(errors: FieldError[]): string {
  const parts = errors.map((e) => {
    // Si el mensaje ya menciona el campo, no repetimos la etiqueta.
    const base = strip(e.label.replace(/\s*\(#\d+\)$/, ""));
    return strip(e.message).includes(base) ? e.message : `${e.label}: ${e.message}`;
  });
  return Array.from(new Set(parts)).join("; ");
}
