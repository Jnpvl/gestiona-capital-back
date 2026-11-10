/**
 * Tamaño de muestra representativa (NOM-035-STPS-2018, Guía de referencia III).
 * n = 0.9604 N / (0.0025 (N − 1) + 0.9604), redondeado hacia arriba.
 */
export function representativeSampleSize(populationN: number): number {
  const N = Math.max(0, Math.floor(populationN));
  if (N <= 0) return 0;
  if (N === 1) return 1;
  const n = (0.9604 * N) / (0.0025 * (N - 1) + 0.9604);
  return Math.min(N, Math.ceil(n));
}

export type SamplingMode = "census" | "sample";

export interface GuideSamplingMeta {
  mode: SamplingMode;
  populationN: number;
  sampleN: number;
  stratumField: string;
  selectedStudentIds: string[];
}

/** Reparto proporcional n_i = (N_i / N) × n con método del resto mayor. */
export function allocateProportional(
  groupSizes: Map<string, number>,
  sampleN: number,
): Map<string, number> {
  const N = [...groupSizes.values()].reduce((a, b) => a + b, 0);
  const quotas = new Map<string, number>();
  if (N <= 0 || sampleN <= 0) {
    for (const key of groupSizes.keys()) quotas.set(key, 0);
    return quotas;
  }
  const target = Math.min(sampleN, N);
  const remainders: { key: string; frac: number }[] = [];
  let assigned = 0;
  for (const [key, size] of groupSizes) {
    const exact = (size / N) * target;
    const base = Math.min(size, Math.floor(exact));
    quotas.set(key, base);
    assigned += base;
    remainders.push({ key, frac: exact - Math.floor(exact) });
  }
  remainders.sort((a, b) => b.frac - a.frac || a.key.localeCompare(b.key, "es"));
  let left = target - assigned;
  for (const { key } of remainders) {
    if (left <= 0) break;
    const size = groupSizes.get(key) ?? 0;
    const cur = quotas.get(key) ?? 0;
    if (cur < size) {
      quotas.set(key, cur + 1);
      left -= 1;
    }
  }
  return quotas;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Selección aleatoria estratificada: dentro de cada grupo se eligen n_i al azar.
 * `stratumOf` mapea studentId → etiqueta de estrato (p. ej. sexo).
 */
export function pickStratifiedSample(
  studentIds: string[],
  stratumOf: (studentId: string) => string,
  sampleN: number,
): { selectedStudentIds: string[]; quotas: Map<string, number> } {
  const byGroup = new Map<string, string[]>();
  for (const id of studentIds) {
    const key = stratumOf(id) || "Sin dato";
    const list = byGroup.get(key) ?? [];
    list.push(id);
    byGroup.set(key, list);
  }
  const sizes = new Map<string, number>();
  for (const [key, list] of byGroup) sizes.set(key, list.length);
  const quotas = allocateProportional(sizes, sampleN);
  const selected: string[] = [];
  for (const [key, list] of byGroup) {
    const n = quotas.get(key) ?? 0;
    selected.push(...shuffleInPlace([...list]).slice(0, n));
  }
  return { selectedStudentIds: selected, quotas };
}

export function buildCensusMeta(studentIds: string[]): GuideSamplingMeta {
  const n = studentIds.length;
  return {
    mode: "census",
    populationN: n,
    sampleN: n,
    stratumField: "sexo",
    selectedStudentIds: [...studentIds],
  };
}

export function buildSampleMeta(
  studentIds: string[],
  stratumOf: (studentId: string) => string,
): GuideSamplingMeta {
  const populationN = studentIds.length;
  const sampleN = representativeSampleSize(populationN);
  const { selectedStudentIds } = pickStratifiedSample(studentIds, stratumOf, sampleN);
  return {
    mode: "sample",
    populationN,
    sampleN: selectedStudentIds.length,
    stratumField: "sexo",
    selectedStudentIds,
  };
}
