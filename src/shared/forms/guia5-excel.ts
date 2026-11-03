import { nom035Guia5 } from "./nom035-guia5";
import type { FormQuestion } from "./types";

/** Columnas de Guía V en la plantilla de carga masiva (encabezado → pregunta). */
export interface Guia5Column {
  questionId: string;
  header: string;
  options: string[] | null;
}

const HEADERS: Record<string, string> = {
  sexo: "Sexo",
  edad: "Edad",
  estado_civil: "Estado civil",
  nivel_estudios: "Nivel de estudios (terminada/incompleta)",
  puesto: "Ocupación/profesión/puesto (Guía V)",
  departamento: "Departamento/sección/área",
  tipo_puesto: "Tipo de puesto",
  tipo_contratacion: "Tipo de contratación",
  tipo_personal: "Tipo de personal",
  tipo_jornada: "Tipo de jornada",
  rotacion_turnos: "Rotación de turnos",
  tiempo_puesto: "Tiempo en el puesto actual",
  tiempo_experiencia: "Tiempo de experiencia laboral",
};

const QUESTIONS: FormQuestion[] = nom035Guia5.sections.flatMap((s) => s.questions);

export const GUIA5_COLUMNS: Guia5Column[] = QUESTIONS.map((q) => ({
  questionId: q.id,
  header: HEADERS[q.id] ?? q.text.replace(/:$/, ""),
  options: q.kind === "text" ? null : (q.options ?? []).map((o) => o.value),
}));

/** Todas las preguntas de Guía V son requeridas para darla por completa. */
export const GUIA5_REQUIRED_IDS = GUIA5_COLUMNS.map((c) => c.questionId);

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve el valor canónico de la opción, o null si no coincide. */
export function matchGuia5Option(column: Guia5Column, raw: string): string | null {
  if (!column.options) return raw.trim();
  const target = norm(raw);
  return column.options.find((o) => norm(o) === target) ?? null;
}
