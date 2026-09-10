import type { CourseDetail, CourseInstructorSnapshot, CourseModality } from "../../types/course.types";
import { CONSTANCIA_COPY } from "./constancia-layout";

const MODALITY_LABELS: Record<CourseModality, string> = {
  presencial: "Presencial",
  online: "En línea",
  hibrido: "Híbrido",
};

export interface ConstanciaPdfData {
  studentName: string;
  curp: string;
  courseTitle: string;
  duration: string;
  modality: string;
  period: string;
  issuedPlace: string;
  issuedAt: Date;
  instructorName: string;
  instructorSpecialty: string;
  instructorLicense: string;
  instructorPhotoUrl: string | null;
  instructorLogoUrl: string | null;
  instructorSignatureUrl: string | null;
  certificateNumber: string;
}

function displayText(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || fallback;
}

function toConstanciaUpper(value: string): string {
  return value.trim().toLocaleUpperCase("es-MX");
}

function formatModality(modality: string | null | undefined): string {
  if (!modality) return "—";
  if (modality in MODALITY_LABELS) {
    return MODALITY_LABELS[modality as CourseModality];
  }
  return modality;
}

function resolveInstructorFields(instructor?: CourseInstructorSnapshot | null) {
  return {
    instructorName: toConstanciaUpper(instructor?.name?.trim() || "Nombre del Instructor"),
    instructorSpecialty:
      instructor?.professionalArea?.trim() ||
      instructor?.career?.trim() ||
      "Ocupación o especialidad",
    instructorLicense:
      instructor?.professionalLicense?.trim() || "Cédula Profesional:",
    instructorPhotoUrl: instructor?.photoUrl?.trim() || null,
    instructorLogoUrl: instructor?.logoUrl?.trim() || null,
    instructorSignatureUrl: instructor?.signatureUrl?.trim() || null,
  };
}

export function formatDateEsMx(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatIssuedDateLine(place: string, date: Date): string {
  return `El presente se expide en ${place}, a ${formatDateEsMx(date)}.`;
}

/** Periodo para cursos en línea: inicio de inscripción → fecha de término. */
export function formatOnlinePeriod(startedAt: Date, endedAt: Date): string {
  return `${formatDateEsMx(startedAt)} al ${formatDateEsMx(endedAt)}`;
}

/** URL pública del QR para validar la constancia sin login. */
export function buildConstanciaQrPayload(certificateNumber: string, publicBaseUrl?: string): string {
  const folio = certificateNumber.trim();
  const base = (publicBaseUrl ?? "").replace(/\/$/, "");
  if (base) {
    return `${base}/constancia/${encodeURIComponent(folio)}`;
  }
  return `GCH-CONSTANCIA:${folio}`;
}

export function buildConstanciaPdfData(input: {
  studentName: string;
  curp?: string | null;
  certificateNumber?: string | null;
  issuedAt?: Date;
  periodOverride?: string | null;
  course: Pick<
    CourseDetail,
    "title" | "duration" | "period" | "location" | "modality" | "instructor"
  >;
}): ConstanciaPdfData {
  const issuedPlace =
    input.course.location?.trim() || CONSTANCIA_COPY.defaultIssuedPlace;
  const isOnline = input.course.modality === "online";

  return {
    studentName: toConstanciaUpper(displayText(input.studentName, "Nombre del participante")),
    curp: toConstanciaUpper(displayText(input.curp, "CURP del participante")),
    courseTitle: toConstanciaUpper(displayText(input.course.title, "Nombre del curso")),
    duration: input.course.duration?.trim() || "—",
    modality: formatModality(input.course.modality),
    period:
      input.periodOverride?.trim() ||
      (isOnline
        ? "Fecha de inicio al fecha de término"
        : input.course.period?.trim() || "—"),
    issuedPlace,
    issuedAt: input.issuedAt ?? new Date(),
    ...resolveInstructorFields(input.course.instructor),
    certificateNumber: input.certificateNumber?.trim() || "XXXXXXXX",
  };
}

/** Vista previa admin: datos genéricos + instructor real del curso si existe. */
export function buildConstanciaPreviewData(
  instructor?: CourseInstructorSnapshot | null,
): ConstanciaPdfData {
  return {
    studentName: "NOMBRE DEL PARTICIPANTE",
    curp: "CURP DEL PARTICIPANTE",
    courseTitle: "NOMBRE DEL CURSO",
    duration: "XX horas",
    modality: "Modalidad",
    period: "Fecha de inicio — Fecha de término",
    issuedPlace: CONSTANCIA_COPY.defaultIssuedPlace,
    issuedAt: new Date(2026, 0, 1),
    ...resolveInstructorFields(instructor),
    certificateNumber: "XXXXXXXX",
  };
}
