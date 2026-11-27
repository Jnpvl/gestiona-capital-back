import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { FORM_DEFINITIONS, isSectionVisible, scoreForm, type FormAnswers } from "../src/shared/forms";
import { buildReportHierarchy, renderIndividualReport, reportItemPoints } from "../src/services/individual-report-pdf";
import type { IndividualReportData, ReportGuide, ReportGuideKey } from "../src/services/individual-report.service";

export function fixtureGuide(key: ReportGuideKey): ReportGuide {
  const form = FORM_DEFINITIONS[key];
  const answers: FormAnswers = {};
  for (const section of form.sections) for (const q of section.questions) {
    answers[q.id] = q.options?.[0]?.value ?? (q.kind === "yesno" || form.scale === "yesno" ? "si" : form.scale === "frequency" && q.kind !== "text" ? "casi_siempre" : "Dato de prueba");
  }
  return { key, status: "completed", answers, completedAt: "2025-04-29T18:00:00.000Z", score: key === "nom035_guia5" ? null : scoreForm(form, answers) };
}

export function reportFixture(key: "nom035_guia2" | "nom035_guia3" = "nom035_guia3"): IndividualReportData {
  return {
    company: { id: "11111111-1111-4111-8111-111111111111", name: "EMPRESA DE PRUEBA DEL NOROESTE", rfc: "EPN010101ABC", activityMain: "Servicios profesionales",
      address: null, addressStreet: "Calle Principal", addressExteriorNumber: "123", addressInteriorNumber: null,
      addressNeighborhood: "Centro", addressPostalCode: "85400", addressCity: "Guaymas", addressMunicipality: "Guaymas",
      addressState: "Sonora", addressCountry: "México", addressBetweenStreet1: null, addressBetweenStreet2: null,
      employerRepresentative: "Representante de prueba", workersRepresentative: null, workersCount: 120,
      accessEmail: null, hasAccess: false, lastLoginAt: null, studentsCount: 120, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
    employee: { id: "22222222-2222-4222-8222-222222222222", name: "MARÍA FERNANDA PÉREZ DE PRUEBA", curp: null },
    year: 2025,
    evaluationStartedAt: "2025-03-01T12:00:00.000Z",
    generatedAt: "2026-11-24T18:00:00.000Z",
    riskGuide: key,
    guides: [fixtureGuide("nom035_guia1"), fixtureGuide(key), fixtureGuide("nom035_guia5")],
    referralStatus: "En atención",
    advisorLogoUrl: null,
  };
}

test("los puntos individuales coinciden con el total del motor para II y III", () => {
  for (const key of ["nom035_guia2", "nom035_guia3"] as const) {
    const guide = fixtureGuide(key), form = FORM_DEFINITIONS[key];
    const points = form.sections.filter(s => isSectionVisible(s, guide.answers, form)).flatMap(s => s.questions)
      .reduce((sum, q) => sum + (reportItemPoints(form, q, guide) ?? 0), 0);
    assert.equal(points, guide.score?.final?.value);
    const positive = form.sections.flatMap(s => s.questions).find(q => q.number != null && form.scoring!.positiveItems.includes(q.number))!;
    const negative = form.sections.flatMap(s => s.questions).find(q => q.number != null && !form.scoring!.positiveItems.includes(q.number))!;
    assert.equal(reportItemPoints(form, positive, guide), 1);
    assert.equal(reportItemPoints(form, negative, guide), 3);
    delete guide.answers[positive.id];
    assert.equal(reportItemPoints(form, positive, guide), null);
  }
});

test("genera PDFs tamaño carta para ambas guías sin cambiar los datos de origen", async () => {
  for (const key of ["nom035_guia2", "nom035_guia3"] as const) {
    const data = reportFixture(key), before = JSON.stringify(data);
    const pdf = await PDFDocument.load(await renderIndividualReport(data));
    assert.ok(pdf.getPageCount() >= 5);
    for (const page of pdf.getPages()) assert.deepEqual(page.getSize(), { width: 612, height: 792 });
    assert.equal(pdf.getAuthor(), data.company.name);
    assert.equal(JSON.stringify(data), before);
  }
});

test("guías parciales y sin riesgo no generan una calificación final", async () => {
  const data = reportFixture(); data.riskGuide = null;
  data.guides = [{ ...fixtureGuide("nom035_guia1"), status: "partial", answers: { s1_1: "si" }, score: null },
    { ...fixtureGuide("nom035_guia5"), status: "pending", answers: {}, score: null }];
  const pdf = await PDFDocument.load(await renderIndividualReport(data));
  assert.ok(pdf.getPageCount() >= 3);
});


test("la jerarquía conserva sumas y las dimensiones heredan el nivel de su dominio", () => {
  for (const key of ["nom035_guia2", "nom035_guia3"] as const) {
    const guide = fixtureGuide(key);
    const rows = buildReportHierarchy(guide);
    let domain: typeof rows[number] | undefined;
    let dimensionTotal = 0;
    const finishDomain = () => { if (domain) assert.equal(dimensionTotal, domain.value); };
    for (const row of rows) {
      if (row.kind === "dimension") {
        assert.equal(row.level, domain?.level);
        dimensionTotal += row.value;
      } else {
        finishDomain(); dimensionTotal = 0;
        domain = row.kind === "domain" ? row : undefined;
      }
    }
    finishDomain();
    assert.equal(rows.filter(row => row.kind === "category").reduce((sum, row) => sum + row.value, 0), guide.score?.final?.value);
    assert.equal(rows.filter(row => row.kind === "dimension").length, FORM_DEFINITIONS[key].scoring!.categories.flatMap(c => c.domains.flatMap(d => d.dimensions)).length);
    assert.deepEqual(buildReportHierarchy({ ...guide, score: null }), []);
  }
});
