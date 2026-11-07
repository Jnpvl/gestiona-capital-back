import crypto from "crypto";
import ExcelJS from "exceljs";
import { AppError } from "../errors/app-error";
import { findCompanyById } from "../repositories/company.repository";
import {
  deleteStudentCreatedInImport,
  linkStudentToCompanyWithGuia5,
  upsertEmployeeGuia5,
} from "../repositories/form.repository";
import {
  GUIA5_COLUMNS,
  GUIA5_REQUIRED_IDS,
  matchGuia5Option,
} from "../shared/forms/guia5-excel";
import {
  createStudent,
  findStudentByCurp,
  findStudentByEmail,
  updateStudent,
} from "../repositories/student.repository";
import {
  findStpsOccupationByCode,
  listAllStpsOccupations,
} from "../repositories/stps.repository";
import {
  ageFromCurp,
  cellText,
  genderFromCurp,
  loadFirstSheet,
  normalizeHeader,
} from "../shared/utils/excel";
import { companyEmployeeImportRowSchema } from "../validators/company.validator";
import { notifySafely, sendStudentWelcomeEmail } from "./notification.service";

export interface CompanyEmployeeImportRowResult {
  row: number;
  curp: string;
  name: string;
  email: string;
  /** updated = empleado ya existía y se guardó/actualizó Guía V del año elegido. */
  status: "created" | "existing" | "updated" | "linked" | "error";
  studentId?: string;
  message?: string;
}

export interface CompanyEmployeeImportResult {
  companyId: string;
  totalRows: number;
  created: number;
  existing: number;
  /** Empleados existentes a los que se les guardó Guía V del año seleccionado. */
  updated: number;
  linked: number;
  errors: number;
  evaluationYear: number | null;
  welcomeEmailSent: boolean;
  rows: CompanyEmployeeImportRowResult[];
}

type ColumnKey =
  | "curp"
  | "paternalLastName"
  | "maternalLastName"
  | "firstNames"
  | "email"
  | "phone"
  | "currentPosition"
  | "stpsOccupationCode";

/**
 * Extrae el código STPS de celdas tipo "01.1" o "01.1 — Nombre".
 * Excel suele convertir "05" en el número 5; se normaliza a "05".
 */
function parseStpsOccupationCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const code = trimmed.split(/\s*[—\-–|]\s*/)[0]?.trim() ?? trimmed;
  if (!code) return null;
  const match = code.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return code;
  const area = match[1].padStart(2, "0");
  return match[2] != null ? `${area}.${match[2]}` : area;
}

const GUIA5_HEADER_INDEX = new Map(
  GUIA5_COLUMNS.map((c) => [normalizeHeader(c.header), c.questionId]),
);

const TEMPLATE_ROWS = 1000;

function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Columnas de Guía V presentes en el Excel: questionId → índice. */
function mapGuia5Headers(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    const qid = GUIA5_HEADER_INDEX.get(normalizeHeader(header ?? ""));
    if (qid) map.set(qid, index);
  });
  return map;
}

function mapHeaders(headers: string[]): Partial<Record<ColumnKey, number>> {
  const map: Partial<Record<ColumnKey, number>> = {};
  headers.forEach((header, index) => {
    const key = normalizeHeader(header ?? "");
    if (!key) return;
    if (GUIA5_HEADER_INDEX.has(key)) return;
    if (key.includes("curp")) map.curp = index;
    else if (key.includes("paterno")) map.paternalLastName = index;
    else if (key.includes("materno")) map.maternalLastName = index;
    else if (key === "nombre" || key.includes("nombre s") || key.startsWith("nombres"))
      map.firstNames = index;
    else if (key.includes("correo") || key.includes("email")) map.email = index;
    else if (key.includes("telefono") || key.includes("celular")) map.phone = index;
    else if (
      key.includes("codigo ocupacion stps") ||
      key.includes("codigo stps") ||
      (key.includes("stps") && key.includes("ocupacion"))
    ) {
      map.stpsOccupationCode = index;
    } else if (key.includes("puesto") && !key.includes("guia")) {
      map.currentPosition = index;
    }
  });
  return map;
}

export class CompanyEmployeesImportService {
  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Empleados");
    // 8 columnas base (índices 0–7); Guía V empieza en el 8.
    const baseColumnCount = 8;
    sheet.columns = [
      { header: "CURP", key: "curp", width: 22 },
      { header: "Apellido paterno", key: "paternalLastName", width: 20 },
      { header: "Apellido materno", key: "maternalLastName", width: 20 },
      { header: "Nombre(s)", key: "firstNames", width: 22 },
      { header: "Correo", key: "email", width: 28 },
      { header: "Teléfono", key: "phone", width: 16 },
      { header: "Puesto", key: "currentPosition", width: 22 },
      { header: "Código ocupación STPS", key: "stpsOccupationCode", width: 24 },
      ...GUIA5_COLUMNS.map((c) => ({
        header: c.header,
        key: `g5_${c.questionId}`,
        width: Math.max(18, Math.min(45, c.header.length + 4)),
      })),
    ];
    sheet.getRow(1).font = { bold: true };

    // Catálogo STPS de referencia (opcional; no es lista desplegable por tamaño).
    const stpsSheet = workbook.addWorksheet("Catálogo STPS");
    stpsSheet.columns = [
      { header: "Código", key: "code", width: 14 },
      { header: "Ocupación", key: "name", width: 55 },
    ];
    stpsSheet.getRow(1).font = { bold: true };
    const occupations = await listAllStpsOccupations();
    for (const occupation of occupations) {
      stpsSheet.addRow({ code: occupation.code, name: occupation.name });
    }

    // Hoja de opciones de Guía V + listas desplegables en la hoja principal.
    const options = workbook.addWorksheet("Opciones Guía V");
    const choiceCols = GUIA5_COLUMNS.filter((c) => c.options);
    choiceCols.forEach((c, i) => {
      const col = options.getColumn(i + 1);
      col.width = Math.max(18, Math.min(50, ...c.options!.map((o) => o.length + 2)));
      options.getCell(1, i + 1).value = c.header;
      options.getCell(1, i + 1).font = { bold: true };
      c.options!.forEach((o, j) => {
        options.getCell(j + 2, i + 1).value = o;
      });
      const letter = columnLetter(i);
      const range = `'Opciones Guía V'!$${letter}$2:$${letter}$${c.options!.length + 1}`;
      const mainIndex = baseColumnCount + GUIA5_COLUMNS.indexOf(c);
      const mainLetter = columnLetter(mainIndex);
      for (let r = 2; r <= TEMPLATE_ROWS + 1; r += 1) {
        sheet.getCell(`${mainLetter}${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [range],
          showErrorMessage: true,
          errorTitle: "Valor no válido",
          error: "Elige una opción de la lista (hoja Opciones Guía V).",
        };
      }
    });

    sheet.addRow({
      curp: "BAPM970114HSRRXN00",
      paternalLastName: "Barrón",
      maternalLastName: "Peña",
      firstNames: "Manuel Alejandro",
      email: "ejemplo@correo.com",
      phone: "6621234567",
      currentPosition: "Operador",
      stpsOccupationCode: occupations[0]?.code ?? "",
      g5_sexo: "Masculino",
      g5_edad: "25 - 29",
      g5_estado_civil: "Soltero",
      g5_nivel_estudios: "Licenciatura - Terminada",
      g5_puesto: "Operador de montacargas",
      g5_departamento: "Almacén",
      g5_tipo_puesto: "Operativo",
      g5_tipo_contratacion: "Tiempo indeterminado",
      g5_tipo_personal: "Ninguno",
      g5_tipo_jornada: "Fijo mixto (combinación de nocturno y diurno)",
      g5_rotacion_turnos: "No",
      g5_tiempo_puesto: "Entre 1 a 4 años",
      g5_tiempo_experiencia: "Entre 5 a 9 años",
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async importExcel(
    companyId: string,
    fileBuffer: Buffer,
    options: { createdByStaffId?: string | null; sendWelcomeEmail?: boolean; evaluationYear?: number } = {},
  ): Promise<CompanyEmployeeImportResult> {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");
    const sendWelcomeEmail = options.sendWelcomeEmail === true;

    const { sheet, headers } = await loadFirstSheet(fileBuffer);
    const cols = mapHeaders(headers);
    for (const key of ["curp", "paternalLastName", "firstNames", "email"] as const) {
      if (cols[key] == null) {
        throw new AppError(
          400,
          `Falta la columna requerida: ${key}. Usa la plantilla de ejemplo.`,
          "EXCEL_HEADERS",
        );
      }
    }

    const g5Cols = mapGuia5Headers(headers);
    const raw: {
      rowNumber: number;
      values: Record<ColumnKey, string>;
      guia5: Record<string, string>;
    }[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const get = (k: ColumnKey) =>
        cols[k] != null ? cellText(row.getCell((cols[k] as number) + 1).value) : "";
      const values = {
        curp: get("curp"),
        paternalLastName: get("paternalLastName"),
        maternalLastName: get("maternalLastName"),
        firstNames: get("firstNames"),
        email: get("email"),
        phone: get("phone"),
        currentPosition: get("currentPosition"),
        stpsOccupationCode: get("stpsOccupationCode"),
      };
      const guia5: Record<string, string> = {};
      for (const [qid, idx] of g5Cols) {
        const v = cellText(row.getCell(idx + 1).value);
        if (v) guia5[qid] = v;
      }
      if (Object.values(values).every((v) => !v) && Object.keys(guia5).length === 0) return;
      raw.push({ rowNumber, values, guia5 });
    });

    if (raw.length === 0) {
      throw new AppError(400, "El Excel no tiene filas de empleados", "EXCEL_EMPTY");
    }

    if (raw.some((row) => Object.keys(row.guia5).length > 0) &&
        (!Number.isInteger(options.evaluationYear) || options.evaluationYear! < 2000 || options.evaluationYear! > 2100)) {
      throw new AppError(400, "Selecciona el año de evaluación al importar datos de Guía V", "EVALUATION_YEAR_REQUIRED");
    }

    const rows: CompanyEmployeeImportRowResult[] = [];
    const seen = new Set<string>();
    let created = 0;
    let existing = 0;
    let updated = 0;
    let linked = 0;
    let errors = 0;
    const guia5Year = options.evaluationYear ?? null;

    for (const { rowNumber, values, guia5: guia5Raw } of raw) {
      const name = [values.paternalLastName, values.maternalLastName, values.firstNames]
        .filter(Boolean)
        .join(" ");
      const base = {
        row: rowNumber,
        curp: values.curp.toUpperCase() || "—",
        name: name || "—",
        email: values.email.toLowerCase() || "—",
      };
      const fail = (message: string) => {
        errors += 1;
        rows.push({ ...base, status: "error", message });
      };

      const parsed = companyEmployeeImportRowSchema.safeParse({
        ...values,
        maternalLastName: values.maternalLastName || null,
        phone: values.phone || null,
        currentPosition: values.currentPosition || null,
        stpsOccupationCode: parseStpsOccupationCode(values.stpsOccupationCode),
      });
      if (!parsed.success) {
        fail(parsed.error.issues.map((i) => i.message).join("; "));
        continue;
      }
      const data = parsed.data;

      // STPS opcional: si viene código, debe existir en el catálogo.
      let stpsOccupationCode: string | null = data.stpsOccupationCode;
      if (stpsOccupationCode) {
        const occupation = await findStpsOccupationByCode(stpsOccupationCode);
        if (!occupation) {
          fail(`Código ocupación STPS "${stpsOccupationCode}" no existe en el catálogo`);
          continue;
        }
        stpsOccupationCode = occupation.code;
      }

      const applyStpsIfPresent = async (studentId: string) => {
        if (!stpsOccupationCode) return;
        await updateStudent(studentId, { stpsOccupationCode });
      };

      // Guía V (opcional): validar contra las opciones de la definición.
      const guia5: Record<string, string> = {};
      const guia5Errors: string[] = [];
      for (const col of GUIA5_COLUMNS) {
        const v = guia5Raw[col.questionId];
        if (!v) continue;
        const matched = matchGuia5Option(col, v);
        if (matched == null) guia5Errors.push(`${col.header}: "${v}" no es una opción válida`);
        else guia5[col.questionId] = matched;
      }
      if (guia5Errors.length > 0) {
        fail(guia5Errors.join("; "));
        continue;
      }
      const guia5Input = (studentId: string) =>
        Object.keys(guia5).length === 0
          ? null
          : {
              companyId,
              studentId,
              answers: guia5,
              evaluationYear: options.evaluationYear,
              completed: GUIA5_REQUIRED_IDS.every((id) => !!guia5[id]),
              staffId: options.createdByStaffId ?? null,
              requiredCount: GUIA5_REQUIRED_IDS.length,
            };
      const saveGuia5 = async (studentId: string) => {
        const g = guia5Input(studentId);
        if (g) await upsertEmployeeGuia5(g);
      };

      if (seen.has(data.curp) || seen.has(data.email)) {
        fail("Duplicado dentro del archivo");
        continue;
      }
      seen.add(data.curp);
      seen.add(data.email);

      try {
        const byCurp = await findStudentByCurp(data.curp);
        const byEmail = await findStudentByEmail(data.email);
        const match = byCurp
          ? { id: byCurp.id, companyId: byCurp.companyId }
          : byEmail
            ? { id: byEmail.id, companyId: byEmail.company_id ?? null }
            : null;

        if (byCurp && byEmail && byCurp.id !== byEmail.id) {
          fail("La CURP y el correo pertenecen a alumnos distintos");
          continue;
        }

        if (match) {
          if (match.companyId === companyId) {
            const hadGuia5 = Object.keys(guia5).length > 0;
            await saveGuia5(match.id);
            await applyStpsIfPresent(match.id);
            if (hadGuia5) {
              updated += 1;
              rows.push({
                ...base,
                status: "updated",
                studentId: match.id,
                message: `Empleado existente · Guía V guardada para ${guia5Year}`,
              });
            } else {
              existing += 1;
              rows.push({
                ...base,
                status: "existing",
                studentId: match.id,
                message: "Ya existe en esta empresa",
              });
            }
          } else if (!match.companyId) {
            // Existía sin empresa: se vincula (sin tocar contraseña ni datos) y se guarda su Guía V.
            const ok = await linkStudentToCompanyWithGuia5({
              companyId,
              studentId: match.id,
              guia5: guia5Input(match.id),
            });
            if (!ok) {
              fail("El alumno fue vinculado a otra empresa mientras se importaba");
            } else {
              await applyStpsIfPresent(match.id);
              linked += 1;
              rows.push({
                ...base,
                status: "linked",
                studentId: match.id,
                message: "Ya estaba registrado sin empresa; se vinculó a esta empresa",
              });
            }
          } else {
            const other = await findCompanyById(match.companyId);
            fail(
              `Ya registrado en otra empresa${other ? `: ${other.name}` : ""}. Desvincúlalo de esa empresa para agregarlo aquí`,
            );
          }
          continue;
        }

        const password = crypto.randomBytes(9).toString("base64url");
        const student = await createStudent({
          paternalLastName: data.paternalLastName,
          maternalLastName: data.maternalLastName,
          firstNames: data.firstNames,
          email: data.email,
          password,
          phone: data.phone || "0000000000",
          alumnoType: "trabajador",
          curp: data.curp,
          gender: genderFromCurp(data.curp),
          age: ageFromCurp(data.curp),
          residenceLocation: "Sin especificar",
          currentPosition: data.currentPosition,
          stpsOccupationCode,
          currentlyEmployed: true,
          companyId,
          notes: "Alta por carga masiva de empleados (Excel)",
          active: true,
          createdByStaffId: options.createdByStaffId ?? null,
        });
        try {
          await saveGuia5(student.id);
        } catch (guia5Error) {
          // Sin transacción en createStudent: se revierte a mano para no dejar altas a medias.
          await deleteStudentCreatedInImport(student.id).catch(() => undefined);
          throw guia5Error;
        }
        // Los accesos solo se envían si se eligió en la carga masiva.
        if (sendWelcomeEmail) {
          await notifySafely(() =>
            sendStudentWelcomeEmail({ name: student.name, email: student.email, password }),
          );
        }
        created += 1;
        rows.push({ ...base, name: student.name, status: "created", studentId: student.id });
      } catch (error) {
        fail(error instanceof Error ? error.message : "Error al crear el empleado");
      }
    }

    return {
      companyId,
      totalRows: raw.length,
      created,
      existing,
      updated,
      linked,
      errors,
      evaluationYear: guia5Year,
      welcomeEmailSent: sendWelcomeEmail && created > 0,
      rows,
    };
  }
}

export const companyEmployeesImportService = new CompanyEmployeesImportService();
