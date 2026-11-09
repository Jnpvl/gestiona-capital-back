export type FormKey = "nom035_guia1" | "nom035_guia2" | "nom035_guia3" | "nom035_guia5";

/** yesno: Sí/No (Guía I y preguntas filtro). frequency: Siempre…Nunca. none: ficha de datos. */
export type FormScale = "yesno" | "frequency" | "none";

export type RiskLevel = "nulo" | "bajo" | "medio" | "alto" | "muy_alto";

export interface FormOption {
  value: string;
  label: string;
}

export interface FormQuestion {
  id: string;
  /** Número de ítem según la norma (Guías II y III). */
  number?: number;
  text: string;
  /**
   * Texto para reportes/resultados cuando el documento lo pide distinto al del cuestionario.
   * Si no existe, se usa `text`.
   */
  resultQuestion?: string;
  /** Por defecto se usa la escala del formulario. */
  kind?: "yesno" | "choice" | "text";
  options?: FormOption[];
  note?: string;
}

export type SectionCondition =
  | { questionId: string; equals: string }
  | { anyYesInSection: string };

export interface FormSection {
  id: string;
  title?: string;
  instructions?: string;
  showIf?: SectionCondition;
  questions: FormQuestion[];
}

export interface ScoringDimension {
  name: string;
  items: number[];
}

export interface ScoringDomain {
  key: string;
  name: string;
  /** Límites [bajo, medio, alto, muy alto]: valor < c[0] = nulo, ≥ c[3] = muy alto. */
  cutoffs: [number, number, number, number] | number[];
  dimensions: ScoringDimension[];
}

export interface ScoringCategory {
  key: string;
  name: string;
  cutoffs: [number, number, number, number] | number[];
  domains: ScoringDomain[];
}

export interface FormScoring {
  /** Ítems calificados Siempre=0 … Nunca=4. El resto: Siempre=4 … Nunca=0. */
  positiveItems: number[];
  finalCutoffs: number[];
  categories: ScoringCategory[];
}

export interface ClinicalRule {
  screeningSection: string;
  thresholds: { sectionId: string; minYes: number }[];
}

export interface FormDefinition {
  key: FormKey;
  norm: string;
  title: string;
  subtitle: string;
  description: string;
  instructions?: string;
  scale: FormScale;
  sections: FormSection[];
  scoring?: FormScoring;
  clinicalRule?: ClinicalRule;
}

export type FormAnswers = Record<string, string>;
