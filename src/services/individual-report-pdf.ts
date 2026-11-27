import fs from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { FORM_DEFINITIONS, FREQUENCY_OPTIONS, YES_NO_OPTIONS, RISK_LEVEL_LABEL, isSectionVisible,
  type FormDefinition, type FormQuestion, type RiskLevel } from "../shared/forms";
import type { IndividualReportData, ReportGuide } from "./individual-report.service";

const BLUE = rgb(0.18, 0.19, 0.61), INK = rgb(0.15, 0.15, 0.17), MUTED = rgb(0.4, 0.4, 0.43);
const WHITE = rgb(1, 1, 1), LIGHT = rgb(0.96, 0.96, 0.965), LINE = rgb(0.8, 0.8, 0.82);
const RISK: Record<RiskLevel, ReturnType<typeof rgb>> = {
  nulo: rgb(0.02, 0.69, 0.79), bajo: rgb(0.12, 0.75, 0.35), medio: rgb(0.94, 0.71, 0),
  alto: rgb(1, 0.44, 0.06), muy_alto: rgb(0.94, 0.24, 0.25),
};
const REPORT_RISK_LABEL: Record<RiskLevel, string> = { ...RISK_LEVEL_LABEL, nulo: "Nulo" };
const STATUS: Record<string, string> = { completed: "Completa", partial: "Parcial", pending: "Sin responder",
  not_assigned: "No asignada", not_selected: "No seleccionado en la muestra" };
const date = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("es-MX", { timeZone: "America/Hermosillo" }) : "No registrada";
const longDate = (iso: string | null) => iso
  ? new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Hermosillo" })
  : null;
type Cell = { text: string; level?: RiskLevel; bold?: boolean; center?: boolean; background?: ReturnType<typeof rgb>; color?: ReturnType<typeof rgb>; indent?: number; section?: boolean };

/** Letter-size layout, repeated table headers, complete rows and dynamic page numbers. */
class Layout {
  page!: PDFPage;
  y = 0;
  readonly width = 498.6141732283464;
  readonly left = 56.69291338582678;
  /** Reserva inferior para pie (logo, marca, folio y páginas). */
  readonly bottom = 110;
  constructor(readonly doc: PDFDocument, readonly regular: PDFFont, readonly bold: PDFFont, readonly italic: PDFFont) { this.newPage(); }
  newPage() { this.page = this.doc.addPage([612, 792]); this.y = 752; }
  ensure(height: number) { if (this.y - height < this.bottom) this.newPage(); }
  clean(value: string) { return value.normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); }
  wrap(text: string, width: number, size: number, font = this.regular): string[] {
    const result: string[] = [];
    for (const paragraph of this.clean(text).split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (font.widthOfTextAtSize(line ? `${line} ${word}` : word, size) <= width) { line = line ? `${line} ${word}` : word; continue; }
        if (line) { result.push(line); line = ""; }
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > width && line) { result.push(line); line = ""; }
          line += char;
        }
      }
      result.push(line);
    }
    return result;
  }
  text(text: string, options: { size?: number; bold?: boolean; italic?: boolean; justify?: boolean; color?: ReturnType<typeof rgb>; after?: number; keepTogether?: boolean } = {}) {
    const size = options.size ?? 11, font = options.bold ? this.bold : options.italic ? this.italic : this.regular;
    const lines = this.wrap(text, this.width, size, font);
    const after = options.after ?? 7;
    // Evita dejar un párrafo partido con 1–2 líneas solas en la hoja siguiente.
    if (options.keepTogether) {
      const blockHeight = lines.length * size * 1.2 + after;
      this.ensure(Math.min(blockHeight, 680));
    }
    for (const [index, line] of lines.entries()) {
      this.ensure(size * 1.2);
      const words = line.split(" ");
      if (options.justify && index < lines.length - 1 && words.length > 1) {
        const gap = (this.width - words.reduce((sum, word) => sum + font.widthOfTextAtSize(word, size), 0)) / (words.length - 1);
        let x = this.left;
        for (const word of words) { this.page.drawText(word, { x, y: this.y - size, size, font, color: options.color ?? INK }); x += font.widthOfTextAtSize(word, size) + gap; }
      } else this.page.drawText(line, { x: this.left, y: this.y - size, size, font, color: options.color ?? INK });
      this.y -= size * 1.2;
    }
    this.y -= after;
  }
  heading(text: string) { this.ensure(82); this.text(text.toLocaleUpperCase("es"), { size: 12, bold: true, color: BLUE, after: 17 }); }
  table(headers: string[], widths: number[], rows: Cell[][], options: { size?: number; zebra?: boolean; padding?: number; headerSize?: number; headerPadding?: number; after?: number; borderless?: boolean; inset?: number } = {}) {
    widths = widths.map(width => width * this.width / widths.reduce((sum, item) => sum + item, 0));
    const inset = options.inset ?? 8.5;
    const size = options.size ?? 7, lineHeight = size * 1.15;
    const headerSize = options.headerSize ?? size;
    const padding = options.padding ?? 14;
    const headerLines = headers.map((h, i) => this.wrap(h.toLocaleUpperCase("es"), widths[i] - inset * 2, headerSize, this.bold));
    const headerPadding = options.headerPadding ?? 17;
    const headerHeight = Math.max(...headerLines.map(l => l.length)) * headerSize * 1.15 + headerPadding;
    const header = () => {
      this.page.drawRectangle({ x: this.left, y: this.y - headerHeight, width: this.width, height: headerHeight, color: INK });
      let x = this.left;
      headerLines.forEach((lines, i) => { lines.forEach((line, j) => this.page.drawText(line, { x: x + (widths[i] - this.bold.widthOfTextAtSize(line, headerSize)) / 2, y: this.y - headerPadding / 2 - headerSize - j * headerSize * 1.15, size: headerSize, font: this.bold, color: WHITE })); x += widths[i]; });
      this.y -= headerHeight;
    };
    this.ensure(headerHeight + 45); header();
    rows.forEach((row, index) => {
      const rowWidths = row[0]?.section ? [this.width] : widths;
      const lines = row.map((cell, i) => this.wrap(cell.text, rowWidths[i] - inset * 2 - (cell.indent ?? 0), size, cell.level || cell.bold ? this.bold : this.regular));
      if (row[0]?.section && rows[index + 1]) {
        const nextHeight = Math.max(...rows[index + 1].map((cell, i) => this.wrap(cell.text, widths[i] - inset * 2, size, cell.bold ? this.bold : this.regular).length)) * lineHeight + padding;
        if (this.y - (Math.max(...lines.map(line => line.length)) * lineHeight + padding + nextHeight) < this.bottom) { this.newPage(); header(); }
      }
      let offset = 0;
      const totalLines = Math.max(1, ...lines.map(l => l.length));
      while (offset < totalLines) {
        const rowHeight = (totalLines - offset) * lineHeight + padding;
        if (rowHeight > this.y - this.bottom && rowHeight <= 712 - headerHeight) { this.newPage(); header(); }
        if (this.y - this.bottom < lineHeight + padding) { this.newPage(); header(); }
        const take = Math.min(totalLines - offset, Math.floor((this.y - this.bottom - padding) / lineHeight));
        const height = take * lineHeight + padding;
        let x = this.left;
        row.forEach((cell, i) => {
          const bg = cell.level ? RISK[cell.level] : cell.background ?? (options.zebra && index % 2 === 0 ? LIGHT : WHITE);
          this.page.drawRectangle({ x, y: this.y - height, width: rowWidths[i], height, color: bg,
            ...(options.zebra || options.borderless ? {} : { borderColor: LINE, borderWidth: 0.35 }) });
          lines[i].slice(offset, offset + take).forEach((line, j) => this.page.drawText(line, {
            x: cell.level || cell.center ? x + (rowWidths[i] - (cell.level || cell.bold ? this.bold : this.regular).widthOfTextAtSize(line, size)) / 2 : x + inset + (cell.indent ?? 0), y: this.y - size - padding / 2 - j * lineHeight, size, font: cell.level || cell.bold ? this.bold : this.regular,
            color: cell.level ? (cell.level !== "medio" ? WHITE : INK) : cell.color ?? INK,
          }));
          x += rowWidths[i];
        });
        this.y -= height; offset += take;
        if (offset < totalLines) { this.newPage(); header(); }
      }
    });
    this.y -= options.after ?? 23;
  }
}

export function reportAnswer(form: FormDefinition, question: FormQuestion, guide: ReportGuide): string {
  const answer = guide.answers[question.id];
  if (!answer) return "Sin respuesta";
  const options = question.options ?? (question.kind === "yesno" || form.scale === "yesno" ? YES_NO_OPTIONS : FREQUENCY_OPTIONS);
  return options.find(o => o.value === answer)?.label ?? answer;
}
export function reportItemPoints(form: FormDefinition, question: FormQuestion, guide: ReportGuide): number | null {
  if (question.number == null || !form.scoring) return null;
  const index = FREQUENCY_OPTIONS.findIndex(option => option.value === guide.answers[question.id]);
  if (index < 0) return null;
  return form.scoring.positiveItems.includes(question.number) ? index : 4 - index;
}

/** Orden oficial NOM-035 (Tabla de categorías/dominios/dimensiones), no por puntaje. */
export function buildReportHierarchy(guide: ReportGuide): { kind: "category" | "domain" | "dimension"; name: string; value: number; level?: RiskLevel }[] {
  const form = FORM_DEFINITIONS[guide.key];
  if (!guide.score || !form.scoring) return [];
  const categories = new Map((guide.score.categories ?? []).map(item => [item.key, item]));
  const domains = new Map((guide.score.domains ?? []).map(item => [item.key, item]));
  const points = new Map(form.sections.filter(section => isSectionVisible(section, guide.answers, form)).flatMap(section =>
    section.questions.map(question => [question.number, reportItemPoints(form, question, guide) ?? 0] as const)));
  const rows: ReturnType<typeof buildReportHierarchy> = [];
  for (const category of form.scoring.categories) {
    const result = categories.get(category.key);
    rows.push({ kind: "category", name: category.name, value: result?.value ?? 0, level: result?.level });
    for (const domain of category.domains) {
      const score = domains.get(domain.key);
      rows.push({ kind: "domain", name: domain.name, value: score?.value ?? 0, level: score?.level });
      for (const dimension of domain.dimensions) {
        rows.push({
          kind: "dimension",
          name: dimension.name,
          value: dimension.items.reduce((total, item) => total + (points.get(item) ?? 0), 0),
          level: score?.level,
        });
      }
    }
  }
  return rows;
}

export async function renderIndividualReport(data: IndividualReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([fs.readFile(path.join(process.cwd(), "assets/fonts/OpenSans-Regular.ttf")), fs.readFile(path.join(process.cwd(), "assets/fonts/OpenSans-SemiBold.ttf"))]);
  let regular = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  // Preserve names outside WinAnsi without losing the original's Helvetica layout for Spanish reports.
  try { regular.encodeText(JSON.stringify(data)); } catch {
    regular = await doc.embedFont(regularBytes, { subset: true }); bold = await doc.embedFont(boldBytes, { subset: true }); italic = regular;
  }
  doc.setTitle(`Reporte individual NOM-035 - ${data.employee.name} - ${data.year}`);
  doc.setAuthor(data.company.name); doc.setSubject(`Evaluaciones ${data.year}`);
  const pdf = new Layout(doc, regular, bold, italic);
  const risk = data.guides.find(g => g.key === data.riskGuide), clinical = data.guides.find(g => g.key === "nom035_guia1");
  const demographic = data.guides.find(g => g.key === "nom035_guia5");
  const final = risk?.score?.final;
  const violence = risk?.score?.domains?.find(d => d.key === "violencia");
  const affectedViolence = violence && ["alto", "muy_alto"].includes(violence.level);
  const binary = (value: boolean | undefined) => value == null ? "SIN RESULTADO DISPONIBLE" : value ? "SÍ DETECTADO" : "NO DETECTADO";
  const guideTitle = risk ? FORM_DEFINITIONS[risk.key].title : "Sin guía de riesgo disponible";

  pdf.text("REPORTE INDIVIDUAL NOM-035-STPS-2018", { size: 20, bold: true, color: BLUE, after: 5 });
  pdf.text("FACTORES DE RIESGO PSICOSOCIAL EN EL TRABAJO", { size: 12, after: 3 });
  pdf.text("IDENTIFICACIÓN, ANÁLISIS Y PREVENCIÓN", { size: 12, italic: true, after: 4 });
  pdf.text(
    `Fecha de inicio de evaluación: ${date(data.evaluationStartedAt)} · Periodo ${data.year}`,
    { size: 11, color: MUTED, after: 13 },
  );
  pdf.text(data.employee.name.toLocaleUpperCase("es"), { size: 14, bold: true, color: BLUE, after: 15 });
  const entityLines = pdf.wrap(`EMPRESA: ${data.company.name}`, 310, 11);
  const application = `Fecha de Aplicación: ${date(risk?.completedAt ?? clinical?.completedAt ?? null)}`;
  entityLines.forEach((line, i) => pdf.page.drawText(line, { x: pdf.left, y: pdf.y - 11 - i * 13.2, size: 11, font: regular, color: INK }));
  pdf.page.drawText(application, { x: pdf.left + pdf.width - regular.widthOfTextAtSize(application, 11), y: pdf.y - 11, size: 11, font: regular, color: INK });
  pdf.y -= Math.max(1, entityLines.length) * 13.2;
  const riskLabel = final ? REPORT_RISK_LABEL[final.level].toUpperCase() : "SIN RESULTADO";
  pdf.page.drawText("Nivel de Riesgo:", { x: pdf.left, y: pdf.y - 11, size: 11, font: regular, color: INK });
  pdf.page.drawText(riskLabel, { x: pdf.left + 99, y: pdf.y - 11, size: 11, font: bold, color: final ? RISK[final.level] : MUTED });
  const scoreLabel = `Carga de Puntaje: ${final?.value ?? "—"}`;
  pdf.page.drawText(scoreLabel, { x: pdf.left + pdf.width - regular.widthOfTextAtSize(scoreLabel, 11), y: pdf.y - 11, size: 11, font: regular, color: INK });
  pdf.y -= 20;
  pdf.text(`Presencia de Evento Traumático (Guía I): ${binary(clinical?.score?.traumaticEventReported)}`, { size: 11, after: 7 });
  {
    const violenceValue = binary(violence ? !!affectedViolence : undefined);
    const violenceLabel = "Presencia de Violencia Laboral: ";
    const violenceDetected = !!affectedViolence;
    pdf.ensure(11 * 1.2);
    pdf.page.drawText(violenceLabel, { x: pdf.left, y: pdf.y - 11, size: 11, font: regular, color: INK });
    pdf.page.drawText(violenceValue, {
      x: pdf.left + regular.widthOfTextAtSize(violenceLabel, 11),
      y: pdf.y - 11,
      size: 11,
      font: violenceDetected ? bold : regular,
      color: violenceDetected ? RISK.muy_alto : INK,
    });
    pdf.y -= 11 * 1.2 + 21;
  }
  pdf.heading("Perfil demográfico");
  if (demographic && ["completed", "partial"].includes(demographic.status)) {
    if (demographic.status === "partial") pdf.text("Ficha parcial: los campos pendientes se muestran sin respuesta.", { size: 11, color: MUTED });
    const form = FORM_DEFINITIONS.nom035_guia5;
    const fields = [["puesto", "Puesto"], ["edad", "Edad"], ["sexo", "Género"], ["tipo_contratacion", "Tipo de Contrato"],
      ["tipo_jornada", "Jornada"], ["rotacion_turnos", "¿Rota turnos?"], ["tiempo_experiencia", "Rango de Experiencia"],
      ["estado_civil", "Estado Civil"], ["nivel_estudios", "Nivel Educativo"], ["departamento", "Departamento"],
      ["tipo_puesto", "Tipo de Puesto"], ["tipo_personal", "Tipo de Personal"], ["tiempo_puesto", "Tiempo en el Puesto"]];
    const questions = form.sections.flatMap(section => section.questions);
    pdf.table(["Categoría demográfica", "Valor registrado"], [226, 274], fields.map(([id, label]) => [
      { text: label }, { text: reportAnswer(form, questions.find(question => question.id === id)!, demographic) },
    ]), { zebra: true, size: 11, padding: 8.5, headerSize: 11, headerPadding: 8.5, after: 16 });
  } else pdf.text("Sin ficha demográfica disponible para este año.");

  pdf.ensure(150); pdf.text("RESUMEN EJECUTIVO", { size: 12, bold: true, color: BLUE, after: 7 });
  {
    const periodLabel =
      longDate(data.evaluationStartedAt)
      ?? longDate(risk?.completedAt ?? clinical?.completedAt ?? null)
      ?? String(data.year);
    const appliedGuide = risk
      ? (risk.key === "nom035_guia2" ? "Guía de Referencia II" : "Guía de Referencia III")
      : guideTitle;
    const summaryOpts = { size: 11, justify: true as const, after: 14, keepTogether: true };
    pdf.text(
      `El presente reporte contiene los resultados individuales de la evaluación de factores de riesgo psicosocial de ${data.employee.name}, correspondiente al periodo ${periodLabel}, en ${data.company.name}.`,
      summaryOpts,
    );
    if (final) {
      pdf.text(
        `Se aplicó la ${appliedGuide}, mediante la cual se obtuvo un puntaje total de ${final.value}, correspondiente a un nivel de riesgo ${REPORT_RISK_LABEL[final.level].toLowerCase()}. Los resultados representan la valoración de los factores de riesgo psicosocial identificados a partir de las respuestas proporcionadas por el trabajador. Su finalidad es orientar la prevención, el análisis de las condiciones de trabajo y la implementación de medidas de control.`,
        summaryOpts,
      );
    } else {
      pdf.text(
        `Se contempló la aplicación de la ${appliedGuide}; no existe una evaluación completa de riesgo psicosocial para emitir un puntaje total ni un nivel de riesgo general. Los resultados disponibles representan la valoración a partir de las respuestas proporcionadas por el trabajador. Su finalidad es orientar la prevención, el análisis de las condiciones de trabajo y la implementación de medidas de control.`,
        summaryOpts,
      );
    }
    if (affectedViolence && violence) {
      pdf.text(
        `Respecto al dominio de violencia, se identificó un nivel de riesgo ${REPORT_RISK_LABEL[violence.level].toLowerCase()}, de acuerdo con las respuestas del instrumento aplicado. Los resultados permiten identificar indicadores relacionados con posibles situaciones de violencia laboral que requieren atención y seguimiento. La evaluación no constituye por sí misma una investigación ni una determinación definitiva sobre la existencia de acoso laboral, hostigamiento o conductas específicas. Recomendación: revisar las condiciones y situaciones identificadas, aplicando los mecanismos de atención y prevención establecidos por el centro de trabajo.`,
        summaryOpts,
      );
    }
    const guia1Interpretation = clinical?.score?.resultText
      ?? (clinical && ["completed", "partial"].includes(clinical.status)
        ? "sin interpretación clínica disponible"
        : "sin resultado completo disponible");
    const traumaticEvent = clinical?.score?.traumaticEventReported == null
      ? "EVENTO TRAUMÁTICO SEVERO SIN RESULTADO DISPONIBLE"
      : clinical.score.traumaticEventReported
        ? "EVENTO TRAUMÁTICO SEVERO DETECTADO"
        : "EVENTO TRAUMÁTICO SEVERO NO DETECTADO";
    pdf.text(
      `En relación con la identificación de acontecimientos traumáticos severos, mediante la Guía de Referencia I, se obtuvo el siguiente resultado: ${guia1Interpretation}. ${traumaticEvent}. La identificación de un acontecimiento traumático severo no constituye por sí misma un diagnóstico de trastorno de estrés postraumático.`,
      { ...summaryOpts, after: 20 },
    );
  }
  // Continúa en la misma hoja si hay espacio; evita una hoja casi vacía solo con el cierre del resumen.
  if (pdf.y < 520) pdf.newPage();
  pdf.heading("Resumen de resultados por categoría, dominio y dimensión");
  if (risk?.score) {
    const hierarchy = buildReportHierarchy(risk);
    const rows: Cell[][] = hierarchy.map(row => {
      const category = row.kind === "category", domain = row.kind === "domain";
      const background = category ? INK : domain ? LIGHT : WHITE;
      return [
        { text: `${category ? "CATEGORÍA" : domain ? "DOMINIO" : "Dimensión"}: ${category || domain ? row.name.toUpperCase() : row.name}`, bold: category || domain, background, color: category ? WHITE : MUTED, indent: category ? 0 : domain ? 6 : 12 },
        { text: row.level ? REPORT_RISK_LABEL[row.level].toUpperCase() : "SIN RESULTADO", level: row.level, center: true },
        { text: row.value.toFixed(1), center: true, bold: category || domain, background, color: category ? WHITE : MUTED },
      ];
    });
    pdf.table(["Categoría / Dominio / Dimensión", "Nivel", "Puntos"], [382, 64, 54], rows, { size: 11, padding: 6, headerSize: 11, headerPadding: 7, after: 8 });
  } else {
    pdf.text("Sin resultados completos para el desglose por categoría, dominio y dimensión.");
  }

  pdf.newPage(); pdf.heading("Guías de referencia");
  for (const guide of data.guides.filter(g => g.key !== "nom035_guia5")) {
    const form = FORM_DEFINITIONS[guide.key];
    pdf.ensure(140);
    pdf.heading(guide.key === "nom035_guia1" ? "Guía I: Acontecimientos traumáticos severos" : `Guía ${guide.key === "nom035_guia2" ? "II" : "III"}: Factores de riesgo psicosocial`);
    if (!["completed", "partial"].includes(guide.status)) {
      pdf.text(`No se incluyen respuestas: ${STATUS[guide.status]?.toLowerCase() ?? "sin datos"}.`); continue;
    }
    if (guide.status === "partial") pdf.text("Evaluación parcial. Los puntajes por respuesta no constituyen una calificación final.", { size: 11 });
    // Mismo recorrido que al contestar: secciones visibles + todas sus preguntas, en orden de definición.
    const sectionNames: Record<string, string> = guide.key === "nom035_guia3" ? {
      b1: "Condiciones ambientales", b2: "Cantidad y ritmo de trabajo", b3: "Esfuerzo mental", b4: "Actividades y responsabilidades",
      b5: "Jornada de trabajo", b6: "Decisiones en el trabajo", b7: "Cambios en el trabajo", b8: "Capacitación e información",
      b9: "Jefes", b10: "Relaciones con compañeros", b11: "Rendimiento, reconocimiento, pertenencia y estabilidad", b12: "Violencia laboral",
      filtro_clientes: "Atención a clientes y usuarios", clientes: "Atención a clientes y usuarios",
      filtro_jefe: "Actitudes de personas supervisadas", jefe: "Actitudes de personas supervisadas",
    } : guide.key === "nom035_guia2" ? {
      b1: "Condiciones, cantidad y ritmo de trabajo", b2: "Actividades y responsabilidades", b3: "Jornada y responsabilidades familiares",
      b4: "Decisiones en el trabajo", b5: "Capacitación e información", b6: "Relaciones con compañeros y jefe",
      filtro_clientes: "Atención a clientes y usuarios", clientes: "Atención a clientes y usuarios",
      filtro_jefe: "Actitudes de personas supervisadas", jefe: "Actitudes de personas supervisadas",
    } : {};
    const rows: Cell[][] = [];
    let sequential = 0;
    for (const section of form.sections) {
      if (!isSectionVisible(section, guide.answers, form)) continue;
      if (!section.questions.length) continue;
      rows.push([{
        text: (section.title || sectionNames[section.id] || "Preguntas").toUpperCase(),
        section: true, bold: true, center: true, background: LIGHT,
      }]);
      for (const question of section.questions) {
        sequential += 1;
        const row: Cell[] = [
          { text: question.number != null ? String(question.number) : String(sequential), center: true },
          { text: question.text },
          { text: reportAnswer(form, question, guide) },
        ];
        if (form.scoring) {
          row.push({ text: reportItemPoints(form, question, guide)?.toString() ?? "—", center: true });
        }
        rows.push(row);
      }
    }
    pdf.table(form.scoring ? ["ID", "Pregunta / Rubro", "Respuesta", "Pts"] : ["ID", "Pregunta / Sección", "Respuesta"],
      form.scoring ? [28, 340, 96, 36] : [28, 390, 82], rows, { size: 11, padding: 7, headerSize: 11, headerPadding: 8, inset: 4 });
  }

  pdf.newPage();
  pdf.text("CONFIDENCIALIDAD Y USO DE LA INFORMACIÓN", { size: 12, bold: true, color: BLUE, after: 14 });
  pdf.text(
    `${data.company.name} informa que la información contenida en este reporte corresponde a los resultados individuales de la evaluación de factores de riesgo psicosocial del trabajador, realizada conforme a la NOM-035-STPS.`,
    { size: 11, justify: true, after: 12 },
  );
  pdf.text(
    "Estos resultados tienen como finalidad contribuir a la prevención, análisis, retroalimentación y seguimiento de las condiciones relacionadas con el entorno laboral.",
    { size: 11, justify: true, after: 12 },
  );
  pdf.text(
    `${data.company.name} se compromete a tratar esta información de manera confidencial y restringir su acceso únicamente al personal autorizado, de conformidad con las disposiciones aplicables en materia de protección de datos personales.`,
    { size: 11, justify: true, after: 22 },
  );
  pdf.text("PLATAFORMA TECNOLÓGICA", { size: 12, bold: true, color: BLUE, after: 14 });
  pdf.text(
    "Los datos y resultados contenidos en el presente reporte fueron procesados y generados mediante la Plataforma Gestiona Capital Humano, herramienta tecnológica especializada en la aplicación, evaluación y análisis de los cuestionarios de la NOM-035-STPS.",
    { size: 11, justify: true, after: 12 },
  );
  pdf.text(
    "La plataforma es desarrollada y administrada por Gestiona Capital Humano. Su utilización como herramienta tecnológica no implica que esta haya realizado directamente la aplicación de los cuestionarios, la prestación de servicios de consultoría o la interpretación profesional de los resultados.",
    { size: 11, justify: true, after: 18 },
  );
  pdf.text("Más información: www.gestionach.com", { size: 11, bold: true, color: BLUE, after: 20 });

  pdf.newPage();
  {
    const guia5 = FORM_DEFINITIONS.nom035_guia5;
    const guia5Questions = guia5.sections.flatMap((section) => section.questions);
    const demAnswer = (id: string) => {
      if (!demographic || !["completed", "partial"].includes(demographic.status)) return "____________________";
      const question = guia5Questions.find((item) => item.id === id);
      if (!question) return "____________________";
      const value = reportAnswer(guia5, question, demographic);
      return !value || value === "Sin respuesta" ? "____________________" : value;
    };
    const responsibleName = data.company.employerRepresentative?.trim() || "____________________";

    pdf.text("CONSTANCIA DE RECEPCIÓN DE RESULTADOS", { size: 12, bold: true, color: BLUE, after: 14 });
    pdf.text(
      `Por medio de la presente, hago constar que recibí de ${data.company.name} información y retroalimentación sobre los resultados de mi evaluación de factores de riesgo psicosocial, realizada conforme a la NOM-035-STPS.`,
      { size: 11, justify: true, after: 12 },
    );
    pdf.text(
      "Asimismo, manifiesto que recibí una explicación sobre el significado general de los resultados obtenidos y, en su caso, sobre las medidas de prevención, atención y seguimiento correspondientes.",
      { size: 11, justify: true, after: 12 },
    );
    pdf.text(
      "La firma de este documento acredita únicamente la recepción de la información y la retroalimentación proporcionada. No implica conformidad con los resultados, aceptación de conclusiones sobre conductas específicas ni renuncia a derecho alguno.",
      { size: 11, justify: true, after: 20 },
    );

    pdf.text("Datos de recepción", { size: 11, bold: true, after: 10 });
    pdf.text(`• Nombre del trabajador: ${data.employee.name}`, { size: 11, after: 6 });
    pdf.text(`• Puesto: ${demAnswer("puesto")}`, { size: 11, after: 6 });
    pdf.text(`• Área o departamento: ${demAnswer("departamento")}`, { size: 11, after: 6 });
    pdf.text("• Fecha de entrega: ____________________", { size: 11, after: 22 });

    pdf.text(`Nombre del trabajador: ${data.employee.name}`, { size: 11, after: 28 });
    pdf.text("Firma del trabajador: ____________________", { size: 11, after: 16 });
    pdf.text("Fecha de entrega: ____________________", { size: 11, after: 22 });
    pdf.text(
      `Nombre del responsable que proporciona la retroalimentación: ${responsibleName}`,
      { size: 11, after: 6 },
    );
    pdf.text("Representante legal de la empresa / representante", { size: 11, color: MUTED, after: 14 });
    pdf.text("Puesto: ____________________", { size: 11, after: 28 });
    pdf.text("Firma del responsable: ____________________", { size: 11, after: 10 });
  }

  const logoBytes = await fs.readFile(path.join(process.cwd(), "assets/templates/gch-logo.png"));
  const logo = await doc.embedPng(logoBytes);
  const folio = `NOM035-${data.year}-${data.employee.id.replace(/-/g, "").slice(0, 10).toUpperCase()}${
    data.riskGuide === "nom035_guia2" ? "-II" : data.riskGuide === "nom035_guia3" ? "-III" : ""
  }`;
  const contact = "hola@gestionach.com · https://www.gestionach.com/";
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const logoHeight = 32;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    page.drawImage(logo, { x: pdf.left, y: 68, width: logoWidth, height: logoHeight });

    const brandX = pdf.left + logoWidth + 10;
    page.drawText("Gestiona Capital Humano", {
      x: brandX, y: 88, size: 11, font: bold, color: MUTED,
    });
    const companyLine = pdf.wrap(data.company.name, pdf.width - logoWidth - 10, 11)[0] ?? data.company.name;
    page.drawText(companyLine, {
      x: brandX, y: 74, size: 11, font: regular, color: MUTED,
    });
    page.drawText(contact, {
      x: pdf.left, y: 52, size: 11, font: regular, color: MUTED,
    });
    page.drawText(`Folio: ${folio}`, {
      x: pdf.left, y: 36, size: 11, font: regular, color: MUTED,
    });
    const pageLabel = `Página ${index + 1} de ${pages.length}`;
    page.drawText(pageLabel, {
      x: pdf.left + pdf.width - regular.widthOfTextAtSize(pageLabel, 11),
      y: 36,
      size: 11,
      font: regular,
      color: MUTED,
    });
  });
  return doc.save();
}
