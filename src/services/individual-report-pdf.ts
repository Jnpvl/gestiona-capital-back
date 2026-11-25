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
type Cell = { text: string; level?: RiskLevel; bold?: boolean; center?: boolean; background?: ReturnType<typeof rgb>; color?: ReturnType<typeof rgb>; indent?: number; section?: boolean };

/** Letter-size layout, repeated table headers, complete rows and dynamic page numbers. */
class Layout {
  page!: PDFPage;
  y = 0;
  readonly width = 498.6141732283464;
  readonly left = 56.69291338582678;
  constructor(readonly doc: PDFDocument, readonly regular: PDFFont, readonly bold: PDFFont, readonly italic: PDFFont) { this.newPage(); }
  newPage() { this.page = this.doc.addPage([612, 792]); this.y = 752; }
  ensure(height: number) { if (this.y - height < 40) this.newPage(); }
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
  text(text: string, options: { size?: number; bold?: boolean; italic?: boolean; justify?: boolean; color?: ReturnType<typeof rgb>; after?: number } = {}) {
    const size = options.size ?? 11, font = options.bold ? this.bold : options.italic ? this.italic : this.regular;
    const lines = this.wrap(text, this.width, size, font);
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
    this.y -= options.after ?? 7;
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
        if (this.y - (Math.max(...lines.map(line => line.length)) * lineHeight + padding + nextHeight) < 40) { this.newPage(); header(); }
      }
      let offset = 0;
      const totalLines = Math.max(1, ...lines.map(l => l.length));
      while (offset < totalLines) {
        const rowHeight = (totalLines - offset) * lineHeight + padding;
        if (rowHeight > this.y - 40 && rowHeight <= 712 - headerHeight) { this.newPage(); header(); }
        if (this.y - 40 < lineHeight + padding) { this.newPage(); header(); }
        const take = Math.min(totalLines - offset, Math.floor((this.y - 40 - padding) / lineHeight));
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

export function buildReportHierarchy(guide: ReportGuide): { kind: "category" | "domain" | "dimension"; name: string; value: number; level?: RiskLevel }[] {
  const form = FORM_DEFINITIONS[guide.key];
  if (!guide.score || !form.scoring) return [];
  const categories = new Map((guide.score.categories ?? []).map(item => [item.key, item]));
  const domains = new Map((guide.score.domains ?? []).map(item => [item.key, item]));
  const points = new Map(form.sections.filter(section => isSectionVisible(section, guide.answers, form)).flatMap(section =>
    section.questions.map(question => [question.number, reportItemPoints(form, question, guide) ?? 0] as const)));
  const rows: ReturnType<typeof buildReportHierarchy> = [];
  for (const category of [...form.scoring.categories].sort((a, b) => (categories.get(b.key)?.value ?? 0) - (categories.get(a.key)?.value ?? 0))) {
    const result = categories.get(category.key);
    rows.push({ kind: "category", name: category.name, value: result?.value ?? 0, level: result?.level });
    for (const domain of [...category.domains].sort((a, b) => (domains.get(b.key)?.value ?? 0) - (domains.get(a.key)?.value ?? 0))) {
      const score = domains.get(domain.key);
      rows.push({ kind: "domain", name: domain.name, value: score?.value ?? 0, level: score?.level });
      const dimensions = domain.dimensions.map(dimension => ({ kind: "dimension" as const, name: dimension.name,
        value: dimension.items.reduce((total, item) => total + (points.get(item) ?? 0), 0), level: score?.level }));
      rows.push(...dimensions.sort((a, b) => b.value - a.value));
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
  const followup = clinical?.score?.requiresClinicalAssessment === true || !!affectedViolence || !!(final && ["alto", "muy_alto"].includes(final.level));
  const binary = (value: boolean | undefined) => value == null ? "SIN RESULTADO DISPONIBLE" : value ? "SÍ DETECTADO" : "NO DETECTADO";
  const guideTitle = risk ? FORM_DEFINITIONS[risk.key].title : "Sin guía de riesgo disponible";

  pdf.text("REPORTE INDIVIDUAL NOM-035-STPS-2018", { size: 20, bold: true, color: BLUE, after: 5 });
  pdf.text("FACTORES DE RIESGO PSICOSOCIAL EN EL TRABAJO", { size: 12, after: 3 });
  pdf.text("IDENTIFICACIÓN, ANÁLISIS Y PREVENCIÓN", { size: 12, italic: true, after: 4 });
  pdf.text(`Fecha de evaluación: ${date(risk?.completedAt ?? clinical?.completedAt ?? null)} · Periodo ${data.year}`, { size: 10, color: MUTED, after: 13 });
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
  pdf.text(`Presencia de Violencia Laboral: ${binary(violence ? !!affectedViolence : undefined)}`, { size: 11, after: 21 });
  pdf.heading("Perfil demográfico");
  if (demographic && ["completed", "partial"].includes(demographic.status)) {
    if (demographic.status === "partial") pdf.text("Ficha parcial: los campos pendientes se muestran sin respuesta.", { size: 9, color: MUTED });
    const form = FORM_DEFINITIONS.nom035_guia5;
    const fields = [["puesto", "Puesto"], ["edad", "Edad"], ["sexo", "Género"], ["tipo_contratacion", "Tipo de Contrato"],
      ["tipo_jornada", "Jornada"], ["rotacion_turnos", "¿Rota turnos?"], ["tiempo_experiencia", "Rango de Experiencia"],
      ["estado_civil", "Estado Civil"], ["nivel_estudios", "Nivel Educativo"], ["departamento", "Departamento"],
      ["tipo_puesto", "Tipo de Puesto"], ["tipo_personal", "Tipo de Personal"], ["tiempo_puesto", "Tiempo en el Puesto"]];
    const questions = form.sections.flatMap(section => section.questions);
    pdf.table(["Categoría demográfica", "Valor registrado"], [226, 274], fields.map(([id, label]) => [
      { text: label }, { text: reportAnswer(form, questions.find(question => question.id === id)!, demographic) },
    ]), { zebra: true, size: 8, padding: 8.5, headerPadding: 8.5, after: 16 });
  } else pdf.text("Sin ficha demográfica disponible para este año.");

  pdf.ensure(150); pdf.text("RESUMEN EJECUTIVO", { size: 12, bold: true, color: BLUE, after: 7 });
  pdf.text(`Este reporte presenta las evaluaciones de ${data.employee.name} correspondientes a ${data.year} en ${data.company.name}. ${final ? `${guideTitle}: puntaje ${final.value}, nivel de riesgo ${REPORT_RISK_LABEL[final.level].toLowerCase()}.` : "No existe una evaluación completa de riesgo psicosocial para emitir una calificación final."} ${clinical?.score?.resultText ? `Guía I: ${clinical.score.resultText}.` : "Guía I: sin resultado completo disponible."} ${violence ? `El dominio Violencia presenta nivel ${REPORT_RISK_LABEL[violence.level].toLowerCase()}.` : "No hay resultado disponible del dominio Violencia."}`, { size: 11, justify: true, after: 14 });
  pdf.text(`Estos resultados permiten identificar los factores que requieren revisión y orientar las medidas de prevención, atención y seguimiento del colaborador. El análisis corresponde a las respuestas disponibles del periodo seleccionado. Estatus de seguimiento: ${data.referralStatus || (followup ? "Pendiente" : "Sin canalización registrada")}.`, { size: 11, justify: true, after: 20 });
  pdf.newPage(); pdf.heading("Análisis jerárquico de riesgos (NOM-035)");
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
    pdf.table(["Categoría / Dominio / Dimensión", "Nivel", "Puntos"], [382, 64, 54], rows, { size: 6.8, padding: 5.5, headerPadding: 6, after: 8 });
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
    if (guide.status === "partial") pdf.text("Evaluación parcial. Los puntajes por respuesta no constituyen una calificación final.", { size: 9 });
    const visible = form.sections.filter(s => isSectionVisible(s, guide.answers, form));
    const sectionNames: Record<string, string> = guide.key === "nom035_guia3" ? {
      b1: "Condiciones ambientales", b2: "Cantidad y ritmo de trabajo", b3: "Esfuerzo mental", b4: "Actividades y responsabilidades",
      b5: "Jornada de trabajo", b6: "Decisiones en el trabajo", b7: "Cambios en el trabajo", b8: "Capacitación e información",
      b9: "Jefes", b10: "Relaciones con compañeros", b11: "Rendimiento, reconocimiento, pertenencia y estabilidad", b12: "Violencia laboral",
      clientes: "Atención a clientes y usuarios", jefe: "Actitudes de personas supervisadas",
    } : {
      b1: "Condiciones, cantidad y ritmo de trabajo", b2: "Actividades y responsabilidades", b3: "Jornada y responsabilidades familiares",
      b4: "Decisiones en el trabajo", b5: "Capacitación e información", b6: "Relaciones con compañeros y jefe",
      clientes: "Atención a clientes y usuarios", jefe: "Actitudes de personas supervisadas",
    };
    const allQuestions = form.sections.flatMap(section => section.questions);
    const rows: Cell[][] = [];
    for (const section of visible) {
      const questions = section.questions.filter(question => !form.scoring || question.number != null);
      if (!questions.length) continue;
      rows.push([{ text: (sectionNames[section.id] || section.title || "Preguntas").toUpperCase(), section: true, bold: true, center: true, background: LIGHT }]);
      for (const question of questions) {
        const row: Cell[] = [
          { text: String(question.number ?? allQuestions.findIndex(item => item.id === question.id) + 1), center: true },
          { text: question.text }, { text: reportAnswer(form, question, guide) },
        ];
        if (form.scoring) row.push({ text: reportItemPoints(form, question, guide)?.toString() ?? "—", center: true });
        rows.push(row);
      }
    }
    pdf.table(form.scoring ? ["ID", "Pregunta / Rubro", "Respuesta", "Pts"] : ["ID", "Pregunta / Sección", "Respuesta"],
      form.scoring ? [24, 360, 86, 30] : [24, 412, 64], rows, { size: 8.5, padding: 6, headerSize: 8, headerPadding: 7, inset: 4 });
  }

  pdf.newPage(); pdf.text("DECLARACIÓN:", { size: 12, bold: true, color: BLUE, after: 9 });
  pdf.text(`Declaro que recibí la información sobre los resultados de los cuestionarios aplicados de la NOM-035-STPS-2018, correspondientes a ${data.year}, relativos a factores de riesgo psicosocial, entorno organizacional, acontecimientos traumáticos severos y posibles situaciones de violencia laboral y acoso laboral. Asimismo, se me informaron las medidas de prevención y, en su caso, acciones de control y atención correspondientes. Entiendo que la información será tratada de manera confidencial, pero no anónima, y podrá utilizarse para dar seguimiento a mi situación y, en su caso, para canalización a atención especializada.`, { size: 11, justify: true, after: 20 });
  pdf.text(`Canalización al Psicólogo: ${followup ? "SE IDENTIFICARON MOTIVOS PARA REVISIÓN Y CANALIZACIÓN." : "SIN MOTIVOS IDENTIFICADOS EN LOS RESULTADOS COMPLETOS DISPONIBLES."}`, { bold: true, after: 12 });
  const reasons = [clinical?.score?.requiresClinicalAssessment ? "Guía I: requiere atención clínica" : null,
    final && ["alto", "muy_alto"].includes(final.level) ? `${guideTitle}: riesgo general ${REPORT_RISK_LABEL[final.level].toLowerCase()}` : null,
    affectedViolence ? `${guideTitle}: violencia laboral ${REPORT_RISK_LABEL[violence!.level].toLowerCase()}` : null].filter(Boolean);
  if (reasons.length) pdf.text(`El seguimiento se fundamenta en los hallazgos de las evaluaciones disponibles: ${reasons.join(". ")}. Estos resultados permiten orientar la revisión del caso y, cuando corresponda, su canalización a una valoración profesional especializada.`, { justify: true, after: 14 });
  pdf.text(`(Nivel de Riesgo: ${final ? REPORT_RISK_LABEL[final.level] : "Sin resultado"})`, { bold: true, after: 14 });
  pdf.text(`Estatus registrado: ${data.referralStatus || (followup ? "Pendiente" : "Sin canalización registrada")}.`, { after: 18 });
  if (data.guides.some(g => !["completed", "not_assigned", "not_selected"].includes(g.status))) pdf.text("Hay guías pendientes o parciales; la ausencia de un resultado no equivale a ausencia de riesgo.", { size: 9, color: MUTED, after: 18 });
  pdf.text(`${data.company.name} reconoce el bienestar emocional como pilar fundamental de un entorno laboral sano, seguro y productivo. Te alentamos a recibir esta retroalimentación y, en su caso, tomar la oportunidad de canalización con apertura y confianza, recordando que la prioridad institucional es cuidar de tu salud psicosocial e integridad laboral. La firma acredita la recepción de esta información.`, { justify: true, after: 35 });
  pdf.ensure(115); pdf.text("Firma de recibido:", { bold: true, after: 48 });
  pdf.page.drawLine({ start: { x: pdf.left, y: pdf.y }, end: { x: pdf.left + 160, y: pdf.y }, thickness: 0.8, color: INK });
  pdf.y -= 8; pdf.text(data.employee.name, { bold: true, after: 15 }); pdf.text("Fecha: ____________________", { size: 11, bold: true });

  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const footer = "Gestiona Capital Humano · hola@gestionach.com · https://www.gestionach.com/";
    page.drawText(footer, { x: pdf.left, y: 28, size: 8, font: regular, color: MUTED });
    const pageLabel = `Página ${index + 1} de ${pages.length}`;
    page.drawText(pageLabel, {
      x: pdf.left + pdf.width - regular.widthOfTextAtSize(pageLabel, 8),
      y: 28,
      size: 8,
      font: regular,
      color: MUTED,
    });
  });
  return doc.save();
}
