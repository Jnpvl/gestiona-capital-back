import ExcelJS from "exceljs";
import { AppError } from "../../errors/app-error";

export const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;

export function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text: unknown }).text ?? "").trim();
  }
  return String(value).trim();
}

export function genderFromCurp(curp: string): "masculino" | "femenino" {
  return curp.charAt(10) === "H" ? "masculino" : "femenino";
}

export function ageFromCurp(curp: string): number {
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

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function loadFirstSheet(buffer: Buffer): Promise<{
  sheet: ExcelJS.Worksheet;
  headers: string[];
}> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new AppError(400, "El archivo no es un Excel (.xlsx) válido", "EXCEL_INVALID");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new AppError(400, "El Excel no tiene hojas", "EXCEL_EMPTY");
  }
  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellText(cell.value);
  });
  return { sheet, headers };
}
