import { nom035Guia1 } from "./nom035-guia1";
import { nom035Guia2 } from "./nom035-guia2";
import { nom035Guia3 } from "./nom035-guia3";
import { nom035Guia4 } from "./nom035-guia4";
import { nom035Guia5 } from "./nom035-guia5";
import type {
  FormAnswers,
  FormDefinition,
  FormKey,
  FormSection,
  RiskLevel,
} from "./types";

export * from "./types";

export const FREQUENCY_OPTIONS = [
  { value: "siempre", label: "Siempre" },
  { value: "casi_siempre", label: "Casi siempre" },
  { value: "algunas_veces", label: "Algunas veces" },
  { value: "casi_nunca", label: "Casi nunca" },
  { value: "nunca", label: "Nunca" },
] as const;

export const YES_NO_OPTIONS = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
] as const;

export const FORM_DEFINITIONS: Record<FormKey, FormDefinition> = {
  nom035_guia1: nom035Guia1,
  nom035_guia2: nom035Guia2,
  nom035_guia3: nom035Guia3,
  nom035_guia4: nom035Guia4,
  nom035_guia5: nom035Guia5,
};

export const FORM_KEYS = Object.keys(FORM_DEFINITIONS) as FormKey[];

/** Guías documento (PDF): no se asignan ni generan respuestas; viven en el dashboard NOM-035. */
export const DOCUMENT_FORM_KEYS: readonly FormKey[] = ["nom035_guia4"];

export function isDocumentFormKey(key: string): boolean {
  return (DOCUMENT_FORM_KEYS as readonly string[]).includes(key);
}

/**
 * Formularios que se pueden asignar a una empresa.
 * Guía IV: documento fijo en NOM-035 (no se asigna).
 * Guía V: la captura el admin en la carga masiva de empleados.
 */
export const ASSIGNABLE_FORM_KEYS = FORM_KEYS.filter(
  (k) => k !== "nom035_guia5" && k !== "nom035_guia4",
);

export function isFormKey(value: string): value is FormKey {
  return value in FORM_DEFINITIONS;
}

/**
 * Regla de selección por número de trabajadores (NOM-035-STPS-2018, numerales 5.x / 8.1):
 * - ≤ 15: Guía I + Guía V (solo identificación de acontecimientos traumáticos).
 * - 16 a 50: Guía I + Guía II + Guía V.
 * - > 50: Guía I + Guía III + Guía V.
 * Si no hay número capturado, se sugiere Guía I + Guía V.
 */
export function suggestFormKeys(workersCount: number | null | undefined): FormKey[] {
  if (!workersCount || workersCount <= 15) return ["nom035_guia1"];
  if (workersCount <= 50) return ["nom035_guia1", "nom035_guia2"];
  return ["nom035_guia1", "nom035_guia3"];
}

export function isSectionVisible(section: FormSection, answers: FormAnswers, form: FormDefinition) {
  const cond = section.showIf;
  if (!cond) return true;
  if ("questionId" in cond) return answers[cond.questionId] === cond.equals;
  const target = form.sections.find((s) => s.id === cond.anyYesInSection);
  return !!target?.questions.some((q) => answers[q.id] === "si");
}

const LEVELS: RiskLevel[] = ["nulo", "bajo", "medio", "alto", "muy_alto"];

export function riskLevel(value: number, cutoffs: number[]): RiskLevel {
  let i = 0;
  while (i < cutoffs.length && value >= cutoffs[i]) i += 1;
  return LEVELS[i];
}

const POSITIVE_POINTS: Record<string, number> = {
  siempre: 0,
  casi_siempre: 1,
  algunas_veces: 2,
  casi_nunca: 3,
  nunca: 4,
};

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  nulo: "Nulo o despreciable",
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
  muy_alto: "Muy alto",
};

/** Tablas 4 (Guía II) y 7 (Guía III): criterios para la toma de acciones. */
export const RISK_LEVEL_ACTION: Record<RiskLevel, string> = {
  muy_alto:
    "Se requiere realizar el análisis de cada categoría y dominio para establecer las acciones de intervención apropiadas, mediante un Programa de intervención que deberá incluir evaluaciones específicas, y contemplar campañas de sensibilización, revisar la política de prevención de riesgos psicosociales y programas para la prevención de los factores de riesgo psicosocial, la promoción de un entorno organizacional favorable y la prevención de la violencia laboral, así como reforzar su aplicación y difusión.",
  alto:
    "Se requiere realizar un análisis de cada categoría y dominio, de manera que se puedan determinar las acciones de intervención apropiadas a través de un Programa de intervención, que podrá incluir una evaluación específica y deberá incluir una campaña de sensibilización, revisar la política de prevención de riesgos psicosociales y programas para la prevención de los factores de riesgo psicosocial, la promoción de un entorno organizacional favorable y la prevención de la violencia laboral, así como reforzar su aplicación y difusión.",
  medio:
    "Se requiere revisar la política de prevención de riesgos psicosociales y programas para la prevención de los factores de riesgo psicosocial, la promoción de un entorno organizacional favorable y la prevención de la violencia laboral, así como reforzar su aplicación y difusión, mediante un Programa de intervención.",
  bajo:
    "Es necesario una mayor difusión de la política de prevención de riesgos psicosociales y programas para: la prevención de los factores de riesgo psicosocial, la promoción de un entorno organizacional favorable y la prevención de la violencia laboral.",
  nulo: "El riesgo resulta despreciable por lo que no se requiere medidas adicionales.",
};

/** Guía I: resultado literal de la regla GR.I (sin texto de acción adicional). */
export const CLINICAL_RESULT_TEXT = {
  requires: "El trabajador requerirá atención clínica",
  notRequired: "El trabajador no requiere una valoración clínica",
} as const;

export interface ScoredGroup {
  key: string;
  name: string;
  value: number;
  level: RiskLevel;
}

export interface FormScoreResult {
  traumaticEventReported?: boolean;
  final?: { value: number; level: RiskLevel; action: string };
  categories?: ScoredGroup[];
  domains?: (ScoredGroup & { categoryKey: string })[];
  requiresClinicalAssessment?: boolean;
  /** Guía I: texto literal del resultado. */
  resultText?: string;
}

/** Resumen corto para íconos y tablas. */
export interface FormResultSummary {
  traumaticEventReported?: boolean;
  total?: number;
  level?: RiskLevel;
  requiresClinicalAssessment?: boolean;
  /** Guía I: texto literal del resultado. */
  resultText?: string;
  /** Guías II/III: necesidad de acción (Tablas 4/7). Guía I: vacío. */
  action: string;
}

export function summarizeScore(score: FormScoreResult | null | undefined): FormResultSummary | null {
  if (!score) return null;
  if (score.requiresClinicalAssessment != null) {
    return {
      requiresClinicalAssessment: score.requiresClinicalAssessment,
      traumaticEventReported: score.traumaticEventReported,
      resultText:
        score.resultText ??
        (score.requiresClinicalAssessment ? CLINICAL_RESULT_TEXT.requires : CLINICAL_RESULT_TEXT.notRequired),
      action: "",
    };
  }
  if (!score.final) return null;
  return { total: score.final.value, level: score.final.level, action: score.final.action };
}

/** Calificación según Tablas 2-3 (Guía II) y 5-6 (Guía III); regla GR.I para Guía I. */
export function scoreForm(form: FormDefinition, answers: FormAnswers): FormScoreResult {
  if (form.clinicalRule) {
    const rule = form.clinicalRule;
    const yesIn = (sectionId: string) =>
      form.sections
        .find((s) => s.id === sectionId)
        ?.questions.filter((q) => answers[q.id] === "si").length ?? 0;
    const requires =
      yesIn(rule.screeningSection) > 0 &&
      rule.thresholds.some((t) => yesIn(t.sectionId) >= t.minYes);
    return {
      requiresClinicalAssessment: requires,
      traumaticEventReported: yesIn(rule.screeningSection) > 0,
      resultText: requires ? CLINICAL_RESULT_TEXT.requires : CLINICAL_RESULT_TEXT.notRequired,
    };
  }

  const scoring = form.scoring;
  if (!scoring) return {};

  const positive = new Set(scoring.positiveItems);
  const byNumber = new Map<number, string>();
  for (const section of form.sections) {
    if (!isSectionVisible(section, answers, form)) continue;
    for (const q of section.questions) {
      if (q.number != null && answers[q.id]) byNumber.set(q.number, answers[q.id]);
    }
  }
  const itemScore = (n: number) => {
    const answer = byNumber.get(n);
    if (!answer || !(answer in POSITIVE_POINTS)) return 0;
    const p = POSITIVE_POINTS[answer];
    return positive.has(n) ? p : 4 - p;
  };

  const categories: FormScoreResult["categories"] = [];
  const domains: FormScoreResult["domains"] = [];
  let total = 0;
  for (const cat of scoring.categories) {
    let catSum = 0;
    for (const dom of cat.domains) {
      const domSum = dom.dimensions.flatMap((d) => d.items).reduce((acc, n) => acc + itemScore(n), 0);
      domains.push({
        key: dom.key,
        name: dom.name,
        categoryKey: cat.key,
        value: domSum,
        level: riskLevel(domSum, dom.cutoffs),
      });
      catSum += domSum;
    }
    categories.push({ key: cat.key, name: cat.name, value: catSum, level: riskLevel(catSum, cat.cutoffs) });
    total += catSum;
  }
  return {
    final: (() => {
      const level = riskLevel(total, scoring.finalCutoffs);
      return { value: total, level, action: RISK_LEVEL_ACTION[level] };
    })(),
    categories,
    domains,
  };
}
