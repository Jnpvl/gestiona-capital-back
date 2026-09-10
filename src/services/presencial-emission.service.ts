import ExcelJS from "exceljs";
import crypto from "crypto";
import { AppError } from "../errors/app-error";
import { findCourseById } from "../repositories/course.repository";
import {
  createStudent,
  findStudentByCurp,
  findStudentByEmail,
  upsertPresencialEnrollment,
} from "../repositories/student.repository";
import { issueCertificateNumber, getEnrollmentCertificate } from "../repositories/progress.repository";
import { createCertificateNumber } from "./certificate.service";
import { notifyEnrollmentCompleted } from "./enrollment-notification.service";
import {
  notifySafely,
  sendCourseAccessEmail,
  sendStudentWelcomeEmail,
} from "./notification.service";
import type { StudentDetail } from "../types/student.types";

const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;

export interface PresencialImportRowResult {
  row: number;
  curp: string;
  studentName: string;
  status: "created" | "reused" | "skipped" | "error";
  studentId?: string;
  enrollmentId?: string;
  certificateNumber?: string;
  message?: string;
}

export interface PresencialImportResult {
  courseId: string;
  totalRows: number;
  createdStudents: number;
  reusedStudents: number;
  issuedCertificates: number;
  errors: number;
  rows: PresencialImportRowResult[];
}

interface ParsedRow {
  rowNumber: number;
  curp: string;
  paternalLastName: string;
  maternalLastName: string | null;
  firstNames: string;
  email: string | null;
  phone: string | null;
  startedAt: Date;
  endedAt: Date;
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text: unknown }).text ?? "").trim();
  }
  return String(value).trim();
}

function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Normalize to local calendar date (avoid timezone shifting the day).
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date → UTC calendar day
    const epoch = Date.UTC(1899, 11, 30);
    const utc = new Date(epoch + value * 86400000);
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  }

  if (typeof value === "object" && value !== null && "result" in value) {
    return parseExcelDate((value as { result: unknown }).result);
  }

  const text = cellText(value);
  if (!text) return null;

  // Prefer day/month/year (formato México), e.g. 12/03/2026 = 12 de marzo.
  const mx = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (mx) {
    const day = Number(mx[1]);
    const month = Number(mx[2]);
    const year = Number(mx[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day);
      if (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      ) {
        return date;
      }
    }
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const date = new Date(year, month - 1, day);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function genderFromCurp(curp: string): "masculino" | "femenino" {
  return curp.charAt(10) === "H" ? "masculino" : "femenino";
}

function ageFromCurp(curp: string): number {
  const yy = Number(curp.slice(4, 6));
  const mm = Number(curp.slice(6, 8));
  const dd = Number(curp.slice(8, 10));
  const now = new Date();
  const currentYear = now.getFullYear() % 100;
  const century = yy > currentYear + 5 ? 1900 : 2000;
  const birth = new Date(century + yy, mm - 1, dd);
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  if (age < 1 || age > 120) return 25;
  return age;
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mapHeaderIndex(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (!key) return;
    if (key.includes("curp")) map.curp = index;
    else if (key.includes("paterno")) map.paternalLastName = index;
    else if (key.includes("materno")) map.maternalLastName = index;
    else if (key === "nombre" || key.includes("nombre s") || key.startsWith("nombres")) {
      map.firstNames = index;
    } else if (key.includes("correo") || key.includes("email")) map.email = index;
    else if (key.includes("telefono") || key.includes("celular")) map.phone = index;
    else if (key.includes("inicio")) map.startedAt = index;
    else if (key.includes("termino") || key.includes("fin")) map.endedAt = index;
  });
  return map;
}

async function parseWorkbook(buffer: Buffer): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs typings accept Buffer-like; cast for Node Buffer
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new AppError(400, "El Excel no tiene hojas", "EXCEL_EMPTY");
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellText(cell.value);
  });
  const cols = mapHeaderIndex(headers);

  const required = ["curp", "paternalLastName", "firstNames", "startedAt", "endedAt"] as const;
  for (const key of required) {
    if (cols[key] == null) {
      throw new AppError(
        400,
        `Falta la columna requerida: ${key}. Usa la plantilla de ejemplo.`,
        "EXCEL_HEADERS",
      );
    }
  }

  const rows: ParsedRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const curp = cellText(row.getCell((cols.curp ?? 0) + 1).value).toUpperCase();
    if (!curp) return;

    const paternalLastName = cellText(row.getCell((cols.paternalLastName ?? 0) + 1).value);
    const maternalLastName =
      cols.maternalLastName != null
        ? cellText(row.getCell(cols.maternalLastName + 1).value) || null
        : null;
    const firstNames = cellText(row.getCell((cols.firstNames ?? 0) + 1).value);
    const email =
      cols.email != null ? cellText(row.getCell(cols.email + 1).value).toLowerCase() || null : null;
    const phone =
      cols.phone != null ? cellText(row.getCell(cols.phone + 1).value) || null : null;
    const startedAt = parseExcelDate(row.getCell((cols.startedAt ?? 0) + 1).value);
    const endedAt = parseExcelDate(row.getCell((cols.endedAt ?? 0) + 1).value);

    if (!startedAt || !endedAt) {
      rows.push({
        rowNumber,
        curp,
        paternalLastName,
        maternalLastName,
        firstNames,
        email,
        phone,
        startedAt: startedAt ?? new Date(NaN),
        endedAt: endedAt ?? new Date(NaN),
      });
      return;
    }

    rows.push({
      rowNumber,
      curp,
      paternalLastName,
      maternalLastName,
      firstNames,
      email,
      phone,
      startedAt,
      endedAt,
    });
  });

  return rows;
}

async function resolveStudent(
  row: ParsedRow,
  createdByStaffId?: string | null,
): Promise<{
  student: StudentDetail;
  created: boolean;
  password?: string;
}> {
  const existingByCurp = await findStudentByCurp(row.curp);
  if (existingByCurp) {
    return { student: existingByCurp, created: false };
  }

  const email =
    row.email ||
    `${row.curp.toLowerCase()}@presencial.local`;

  const existingByEmail = await findStudentByEmail(email);
  if (existingByEmail) {
    const byId = await findStudentByCurp(existingByEmail.curp ?? row.curp);
    if (byId) return { student: byId, created: false };
    throw new AppError(
      409,
      `El correo ${email} ya está registrado con otra CURP`,
      "EMAIL_EXISTS",
    );
  }

  const password = crypto.randomBytes(12).toString("base64url");
  const student = await createStudent({
    paternalLastName: row.paternalLastName,
    maternalLastName: row.maternalLastName,
    firstNames: row.firstNames,
    email,
    password,
    phone: row.phone || "0000000000",
    alumnoType: "particular",
    curp: row.curp,
    gender: genderFromCurp(row.curp),
    age: ageFromCurp(row.curp),
    residenceLocation: "Sin especificar",
    notes: "Alta por emisión presencial (Excel)",
    active: true,
    createdByStaffId: createdByStaffId ?? null,
  });

  return { student, created: true, password };
}

export class PresencialEmissionService {
  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Participantes");
    sheet.columns = [
      { header: "CURP", key: "curp", width: 22 },
      { header: "Apellido paterno", key: "paternalLastName", width: 20 },
      { header: "Apellido materno", key: "maternalLastName", width: 20 },
      { header: "Nombre(s)", key: "firstNames", width: 22 },
      { header: "Correo", key: "email", width: 28 },
      { header: "Teléfono", key: "phone", width: 16 },
      { header: "Fecha inicio", key: "startedAt", width: 16 },
      { header: "Fecha término", key: "endedAt", width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };
    const example = sheet.addRow({
      curp: "BAPM970114HSRRXN00",
      paternalLastName: "Barrón",
      maternalLastName: "Peña",
      firstNames: "Manuel Alejandro",
      email: "ejemplo@correo.com",
      phone: "6621234567",
      startedAt: new Date(2026, 2, 12),
      endedAt: new Date(2026, 2, 14),
    });
    example.getCell("startedAt").numFmt = "dd/mm/yyyy";
    example.getCell("endedAt").numFmt = "dd/mm/yyyy";
    sheet.getColumn("startedAt").numFmt = "dd/mm/yyyy";
    sheet.getColumn("endedAt").numFmt = "dd/mm/yyyy";

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importExcel(courseId: string, fileBuffer: Buffer): Promise<PresencialImportResult> {
    const course = await findCourseById(courseId);
    if (!course) {
      throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
    }
    if (course.status !== "published") {
      throw new AppError(
        400,
        "Publica el curso antes de emitir constancias presenciales",
        "COURSE_NOT_PUBLISHED",
      );
    }

    const parsed = await parseWorkbook(fileBuffer);
    if (parsed.length === 0) {
      throw new AppError(400, "El Excel no tiene filas de participantes", "EXCEL_EMPTY");
    }

    const results: PresencialImportRowResult[] = [];
    let createdStudents = 0;
    let reusedStudents = 0;
    let issuedCertificates = 0;
    let errors = 0;

    for (const row of parsed) {
      try {
        if (!CURP_REGEX.test(row.curp)) {
          throw new Error("CURP inválida");
        }
        if (!row.paternalLastName || !row.firstNames) {
          throw new Error("Faltan apellido paterno o nombre(s)");
        }
        if (Number.isNaN(row.startedAt.getTime()) || Number.isNaN(row.endedAt.getTime())) {
          throw new Error("Fechas de inicio/término inválidas");
        }
        if (row.endedAt < row.startedAt) {
          throw new Error("La fecha de término no puede ser anterior al inicio");
        }

        const { student, created, password } = await resolveStudent(
          row,
          course.instructor_id,
        );
        const enrollment = await upsertPresencialEnrollment({
          studentId: student.id,
          courseId,
          startedAt: row.startedAt,
          endedAt: row.endedAt,
        });

        const candidate = createCertificateNumber();
        await issueCertificateNumber(enrollment.enrollmentId, candidate);
        const issued = await getEnrollmentCertificate(enrollment.enrollmentId);
        const certificateNumber = issued.certificateNumber || candidate;

        if (created) createdStudents += 1;
        else reusedStudents += 1;
        issuedCertificates += 1;

        if (created && password) {
          await notifySafely(() =>
            sendStudentWelcomeEmail({
              name: student.name,
              email: student.email,
              password,
            }),
          );
        }
        await notifySafely(() =>
          sendCourseAccessEmail({
            name: student.name,
            email: student.email,
            courseTitle: course.title,
            courseSlug: course.slug,
          }),
        );
        await notifyEnrollmentCompleted(enrollment.enrollmentId);

        results.push({
          row: row.rowNumber,
          curp: row.curp,
          studentName: student.name,
          status: created ? "created" : "reused",
          studentId: student.id,
          enrollmentId: enrollment.enrollmentId,
          certificateNumber,
        });
      } catch (error) {
        errors += 1;
        results.push({
          row: row.rowNumber,
          curp: row.curp || "—",
          studentName: [row.paternalLastName, row.maternalLastName, row.firstNames]
            .filter(Boolean)
            .join(" "),
          status: "error",
          message: error instanceof Error ? error.message : "Error al procesar la fila",
        });
      }
    }

    return {
      courseId,
      totalRows: parsed.length,
      createdStudents,
      reusedStudents,
      issuedCertificates,
      errors,
      rows: results,
    };
  }
}

export const presencialEmissionService = new PresencialEmissionService();
