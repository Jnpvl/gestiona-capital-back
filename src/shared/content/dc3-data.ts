export interface Dc3PdfData {
  studentName: string;
  curp: string;
  occupation: string;
  position: string;
  companyName: string;
  companyRfc: string;
  courseTitle: string;
  durationHours: string;
  periodFrom: { year: string; month: string; day: string };
  periodTo: { year: string; month: string; day: string };
  thematicArea: string;
  trainingAgent: string;
  instructorName: string;
  instructorSignatureUrl: string | null;
  employerName: string;
  workerRepName: string;
  certificateNumber: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function splitDateParts(date: Date): { year: string; month: string; day: string } {
  return {
    year: String(date.getFullYear()),
    month: pad2(date.getMonth() + 1),
    day: pad2(date.getDate()),
  };
}

export function extractDurationHours(duration: string | null | undefined): string {
  if (!duration?.trim()) return "";
  const match = duration.match(/(\d+(?:[.,]\d+)?)/);
  return match?.[1]?.replace(",", ".") ?? duration.trim();
}

export function formatOccupationLabel(
  code: string | null | undefined,
  name: string | null | undefined,
): string {
  const codePart = code?.trim() ?? "";
  const namePart = name?.trim() ?? "";
  if (codePart && namePart) return `${codePart} ${namePart}`;
  return codePart || namePart || "";
}

export function formatThematicAreaLabel(
  code: string | null | undefined,
  name: string | null | undefined,
): string {
  return formatOccupationLabel(code, name);
}

export function formatTrainingAgent(input: {
  name?: string | null;
  aceStpsRegistration?: string | null;
} | null | undefined): string {
  const name = input?.name?.trim() ?? "";
  const stps = input?.aceStpsRegistration?.trim() ?? "";
  if (name && stps) return `${name}  ACE STPS: ${stps}`;
  if (name) return name;
  if (stps) return `ACE STPS: ${stps}`;
  return "Gestiona Capital Humano";
}

export function buildDc3PdfData(input: {
  studentName: string;
  curp?: string | null;
  occupationCode?: string | null;
  occupationName?: string | null;
  position?: string | null;
  companyName: string;
  companyRfc?: string | null;
  courseTitle: string;
  duration?: string | null;
  periodStart: Date;
  periodEnd: Date;
  thematicAreaCode?: string | null;
  thematicAreaName?: string | null;
  trainingAgent?: string | null;
  instructorName?: string | null;
  instructorSignatureUrl?: string | null;
  employerName?: string | null;
  workerRepName?: string | null;
  certificateNumber?: string | null;
}): Dc3PdfData {
  return {
    studentName: input.studentName.trim(),
    curp: (input.curp ?? "").trim().toUpperCase(),
    occupation: formatOccupationLabel(input.occupationCode, input.occupationName),
    position: input.position?.trim() ?? "",
    companyName: input.companyName.trim(),
    companyRfc: (input.companyRfc ?? "").trim().toUpperCase(),
    courseTitle: input.courseTitle.trim(),
    durationHours: extractDurationHours(input.duration),
    periodFrom: splitDateParts(input.periodStart),
    periodTo: splitDateParts(input.periodEnd),
    thematicArea: formatThematicAreaLabel(input.thematicAreaCode, input.thematicAreaName),
    trainingAgent: input.trainingAgent?.trim() || formatTrainingAgent(null),
    instructorName: input.instructorName?.trim() ?? "",
    instructorSignatureUrl: input.instructorSignatureUrl?.trim() || null,
    employerName: input.employerName?.trim() ?? "",
    workerRepName: input.workerRepName?.trim() ?? "",
    certificateNumber: input.certificateNumber?.trim() || "XXXXXXXX",
  };
}

export function buildDc3PreviewData(input: {
  courseTitle: string;
  duration?: string | null;
  instructorName?: string | null;
  instructorAceStps?: string | null;
  instructorSignatureUrl?: string | null;
  thematicAreaCode?: string | null;
  thematicAreaName?: string | null;
}): Dc3PdfData {
  const start = new Date();
  start.setDate(start.getDate() - 5);
  const end = new Date();
  return buildDc3PdfData({
    studentName: "GARCIA LOPEZ JUAN CARLOS",
    curp: "GALG850101HDFRRN09",
    occupationCode: "08.2",
    occupationName: "Administración",
    position: "Supervisor de área",
    companyName: "EMPRESA DEMO SA DE CV",
    companyRfc: "EDE850101AB1",
    courseTitle: input.courseTitle,
    duration: input.duration,
    periodStart: start,
    periodEnd: end,
    thematicAreaCode: input.thematicAreaCode ?? "6000",
    thematicAreaName: input.thematicAreaName ?? "Seguridad",
    trainingAgent: formatTrainingAgent({
      name: input.instructorName,
      aceStpsRegistration: input.instructorAceStps,
    }),
    instructorName: input.instructorName ?? "Nombre del instructor",
    instructorSignatureUrl: input.instructorSignatureUrl,
  });
}
