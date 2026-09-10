export function formatStudentFullName(input: {
  paternalLastName: string;
  maternalLastName?: string | null;
  firstNames: string;
}): string {
  return [input.paternalLastName, input.maternalLastName, input.firstNames]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
}

export function slugifyFilenamePart(value: string, maxLength = 60): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, maxLength);
}

/** Nombre de archivo: nombrecurso-apellidos.pdf */
export function buildConstanciaDownloadFilename(input: {
  courseTitle: string;
  courseSlug?: string;
  paternalLastName?: string | null;
  maternalLastName?: string | null;
}): string {
  const course =
    slugifyFilenamePart(input.courseTitle) ||
    slugifyFilenamePart(input.courseSlug ?? "") ||
    "curso";
  const surnames =
    slugifyFilenamePart(
      [input.paternalLastName, input.maternalLastName]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" "),
    ) || "alumno";
  return `${course}-${surnames}.pdf`;
}
