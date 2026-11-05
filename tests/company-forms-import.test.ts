import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImportAnswers, questionOptions } from "../src/services/company-forms-import.service";
import { FORM_DEFINITIONS, scoreForm } from "../src/shared/forms";

for (const key of ["nom035_guia1", "nom035_guia2", "nom035_guia3"] as const) {
  const form = FORM_DEFINITIONS[key];
  test(`${key}: acepta etiquetas y calcula resultado`, () => {
    const raw = Object.fromEntries(form.sections.flatMap(s => s.questions.map(q => [q.id, questionOptions(form, q)[0].label])));
    const result = parseImportAnswers(form, raw);
    assert.deepEqual(result.errors, []);
    assert.ok(scoreForm(form, result.answers));
  });
  test(`${key}: detecta respuestas faltantes e inválidas`, () => {
    const q = form.sections[0].questions[0];
    assert.ok(parseImportAnswers(form, {}).errors.length);
    assert.ok(parseImportAnswers(form, { [q.id]: "valor inexistente" }).errors.some(e => e.includes("inválida")));
  });
  test(`${key}: no exige ni conserva preguntas ocultas`, () => {
    const raw = Object.fromEntries(form.sections.flatMap(s => s.questions.map(q => [q.id, q.kind === "yesno" || form.scale === "yesno" ? "No" : "Nunca"])));
    const result = parseImportAnswers(form, raw);
    assert.deepEqual(result.errors, []);
    for (const section of form.sections.filter(s => s.showIf)) for (const q of section.questions) assert.equal(result.answers[q.id], undefined);
  });
}
