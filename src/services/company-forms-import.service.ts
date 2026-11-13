import ExcelJS from "exceljs";
import { AppError } from "../errors/app-error";
import { formService } from "./form.service";
import {
  findCompanyEmployeesBasic,
  findEmployeeFormAnswers,
  findGuideSampling,
  currentEvaluationYear,
} from "../repositories/form.repository";
import { FORM_DEFINITIONS, isFormKey, FREQUENCY_OPTIONS, YES_NO_OPTIONS, isSectionVisible } from "../shared/forms";
import type { FormDefinition, FormQuestion } from "../shared/forms";
import { cellText, loadFirstSheet, normalizeHeader } from "../shared/utils/excel";

function definition(key: string) {
  if (!isFormKey(key) || key === "nom035_guia5" || key === "nom035_guia4") {
    throw new AppError(400, "Selecciona la Guía I, II o III", "INVALID_FORM");
  }
  return FORM_DEFINITIONS[key];
}
export function questionOptions(form: FormDefinition, q: FormQuestion) {
  return q.options ?? (q.kind === "yesno" || form.scale === "yesno" ? YES_NO_OPTIONS : FREQUENCY_OPTIONS);
}
export function parseImportAnswers(form: FormDefinition, raw: Record<string, string>) {
  const answers: Record<string, string> = {};
  const errors: string[] = [];
  for (const section of form.sections) for (const q of section.questions) {
    const value = raw[q.id]?.trim();
    if (!value) continue;
    const option = questionOptions(form, q).find(o => normalizeHeader(o.value) === normalizeHeader(value) || normalizeHeader(o.label) === normalizeHeader(value));
    if (!option) errors.push(`${q.id}: respuesta inválida «${value}»`);
    else answers[q.id] = option.value;
  }
  for (const section of form.sections) {
    if (!isSectionVisible(section, answers, form)) {
      for (const q of section.questions) delete answers[q.id];
      continue;
    }
    for (const q of section.questions) if (!answers[q.id]) errors.push(`${q.id}: falta respuesta`);
  }
  return { answers, errors };
}

export class CompanyFormsImportService {
  async template(companyId: string, key: string, evaluationYear?: number) {
    const form = definition(key);
    const year = evaluationYear ?? currentEvaluationYear();
    await formService.getCompanyForms(companyId, year);
    let employees = await findCompanyEmployeesBasic(companyId);
    if (key === "nom035_guia3") {
      const sampling = await findGuideSampling(companyId, "nom035_guia3", year);
      if (sampling?.mode === "sample") {
        const selected = new Set(sampling.selectedStudentIds);
        employees = employees.filter((e) => selected.has(e.id));
      }
    }
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Respuestas", { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
    const questions = form.sections.flatMap(s => s.questions);
    sheet.columns = [{ header: "ID empleado", key: "id", width: 38 }, { header: "Nombre del empleado", key: "name", width: 40 }, ...questions.map(q => ({ header: `${q.id} — ${q.text}`, key: q.id, width: 48 }))];
    for (const employee of employees) sheet.addRow({ id: employee.id, name: employee.name });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, employees.length + 1), column: questions.length + 2 } };
    const instructions = book.addWorksheet("Instrucciones");
    instructions.columns = [{ width: 30 }, { width: 110 }];
    instructions.addRows([
      ["Guía", form.title], ["Empresa ID", companyId], ["Clave guía", key],
      ["Vinculación", "Conserva el ID del empleado. El nombre es una referencia; no se utiliza para identificarlo."],
      ["Captura", "Una fila por empleado. Selecciona las respuestas en las listas desplegables. No ingreses puntajes."],
      ["Preguntas", "Consulta la hoja Preguntas para leer cada enunciado, sección y condición."],
      ["Condicionales", "Deja vacías las preguntas que no apliquen según los filtros. Solo se guardan las respuestas de secciones aplicables."],
      ["Importación", "La guía debe estar asignada. Primero valida el archivo en el sistema y después importa las filas válidas."],
      ["Respuestas existentes", "Las evaluaciones con respuestas previas se omiten, no se sobrescriben. Las filas sin respuestas también se omiten."],
      ["Límite", "Hasta 1000 empleados por archivo. Puedes eliminar filas para dividir la carga sin cambiar los IDs."],
    ]);
    const dictionary = book.addWorksheet("Preguntas");
    dictionary.columns = [{ header: "Código", width: 24 }, { header: "Sección", width: 45 }, { header: "Pregunta", width: 95 }, { header: "Opciones", width: 38 }, { header: "Cuándo responder", width: 65 }];
    const options = book.addWorksheet("Opciones");
    questions.forEach((q, index) => {
      const choices = questionOptions(form, q);
      options.getColumn(index + 1).width = 22;
      options.getCell(1, index + 1).value = q.id;
      choices.forEach((o, row) => { options.getCell(row + 2, index + 1).value = o.label; });
      const letter = options.getColumn(index + 1).letter;
      for (let row = 2; row <= Math.max(2, employees.length + 1); row++) {
        const cell = sheet.getCell(row, index + 3);
        cell.dataValidation = { type: "list", allowBlank: true, formulae: [`'Opciones'!$${letter}$2:$${letter}$${choices.length + 1}`], showErrorMessage: true, errorTitle: "Respuesta inválida", error: "Selecciona una respuesta de la lista." };
        cell.font = { color: { argb: "FF1D4ED8" } };
      }
    });
    for (const section of form.sections) for (const q of section.questions) {
      const condition = !section.showIf ? "Siempre" : "questionId" in section.showIf ? `${section.showIf.questionId} = ${section.showIf.equals}` : `Si alguna respuesta de la sección ${section.showIf.anyYesInSection} es Sí`;
      dictionary.addRow([q.id, [section.title, section.instructions].filter(Boolean).join(" · "), q.text, questionOptions(form, q).map(o => o.label).join(" / "), condition]);
    }
    for (const ws of [sheet, dictionary, options]) {
      ws.getRow(1).height = 30;
      ws.getRow(1).eachCell(cell => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E3192" } }; });
    }
    // Encabezados legibles sin perder el código estable de importación.
    sheet.getRow(1).height = Math.min(300, Math.max(90, ...questions.map(q => Math.ceil((q.id.length + q.text.length + 3) / 42) * 16 + 20)));
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    for (const ws of [dictionary, instructions]) ws.eachRow(row => { row.height = 65; row.alignment = { vertical: "middle", wrapText: true }; });
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  async import(
    companyId: string,
    key: string,
    buffer: Buffer,
    staffId: string | null,
    dryRun: boolean,
    evaluationYear?: number,
  ) {
    const form = definition(key);
    const company = await formService.getCompanyForms(companyId, evaluationYear);
    const year = company.evaluationYear;
    if (!company.assignedFormKeys.includes(form.key)) {
      throw new AppError(
        409,
        `Asigna esta guía a la empresa para ${year} antes de importar`,
        "FORM_NOT_ASSIGNED",
      );
    }
    const employees = new Map((await findCompanyEmployeesBasic(companyId)).map((e) => [e.id, e.name]));
    const sampleSelected =
      key === "nom035_guia3"
        ? await findGuideSampling(companyId, "nom035_guia3", year)
        : null;
    const { sheet, headers: rawHeaders } = await loadFirstSheet(buffer);
    // Acepta también las plantillas anteriores, que solo tenían el código.
    const headers = rawHeaders.map(header => header.split(" — ")[0].trim());
    const book = sheet.workbook;
    const metadata = book.getWorksheet("Instrucciones");
    if (cellText(metadata?.getCell("B2").value) !== companyId || cellText(metadata?.getCell("B3").value) !== key) throw new AppError(400, "La plantilla corresponde a otra empresa o guía. Descarga la plantilla de esta sección.", "TEMPLATE_MISMATCH");
    const questions = form.sections.flatMap(s => s.questions);
    const expected = ["ID empleado", "Nombre del empleado", ...questions.map(q => q.id)];
    if (expected.some(header => headers.filter(h => h === header).length !== 1)) throw new AppError(400, "Faltan columnas o hay encabezados duplicados. Usa la plantilla descargada sin cambiar los encabezados.", "EXCEL_HEADERS");
    if (sheet.actualRowCount > 1001 || sheet.rowCount > 1001) throw new AppError(400, "Máximo 1000 empleados por archivo", "IMPORT_LIMIT");
    const rows: { row: number; employee: string; status: "valid" | "imported" | "skipped" | "error"; message: string }[] = [];
    const seen = new Set<string>();
    const idColumn = headers.indexOf("ID empleado") + 1;
    const occurrences = new Map<string, number>();
    for (let n = 2; n <= sheet.rowCount; n++) {
      const id = cellText(sheet.getRow(n).getCell(idColumn).value);
      if (id) occurrences.set(id, (occurrences.get(id) ?? 0) + 1);
    }
    for (let n = 2; n <= sheet.rowCount; n++) {
      const row = sheet.getRow(n);
      const id = cellText(row.getCell(idColumn).value);
      const raw = Object.fromEntries(questions.map(q => [q.id, cellText(row.getCell(headers.indexOf(q.id) + 1).value)]));
      if (!id && Object.values(raw).every(v => !v)) continue;
      const result = { row: n, employee: employees.get(id) ?? "Empleado no identificado", status: "error" as "valid" | "imported" | "skipped" | "error", message: "" };
      rows.push(result);
      if (!employees.has(id)) { result.message = "El ID no pertenece a un empleado de esta empresa"; continue; }
      if (
        sampleSelected?.mode === "sample" &&
        !sampleSelected.selectedStudentIds.includes(id)
      ) {
        result.message = "No seleccionado para el muestreo de Guía III";
        continue;
      }
      if ((occurrences.get(id) ?? 0) > 1 || seen.has(id)) { result.message = "Empleado duplicado en el archivo"; continue; }
      seen.add(id);
      if (Object.values(raw).every(v => !v)) { result.status = "skipped"; result.message = "Sin respuestas"; continue; }
      const parsed = parseImportAnswers(form, raw);
      if (parsed.errors.length) { result.message = parsed.errors.join("; "); continue; }
      try {
        const current = await findEmployeeFormAnswers(companyId, id, key, year);
        if (current && Object.keys(current.answers).length) {
          result.status = "skipped";
          result.message = `Ya tiene respuestas en ${year}; no se sobrescribió`;
          continue;
        }
        if (!dryRun) {
          await formService.updateEmployeeForm(companyId, id, key, parsed.answers, staffId, {
            onlyIfEmpty: true,
            evaluationYear: year,
          });
        }
        result.status = dryRun ? "valid" : "imported";
        result.message = dryRun ? `Lista para importar a ${year}` : `Evaluación ${year} guardada y calificada`;
      } catch (error) { result.message = error instanceof Error ? error.message : "No se pudo guardar"; }
    }
    return {
      dryRun,
      evaluationYear: year,
      rows,
      valid: rows.filter(r => r.status === "valid").length,
      imported: rows.filter(r => r.status === "imported").length,
      skipped: rows.filter(r => r.status === "skipped").length,
      errors: rows.filter(r => r.status === "error").length,
    };
  }
}
export const companyFormsImportService = new CompanyFormsImportService();
