export const CONSTANCIA_COPY = {
  otorgaA: "Otorga a:",
  curpLabel: "Con Clave Única de Registro de Población:",
  courseLabel: "Constancia de participación",
  durationLabel: "Duración:",
  modalityLabel: "Modalidad:",
  periodLabel: "Periodo:",
  licenseLabel: "Cédula Profesional:",
  folioLabel: "Folio:",
  disclaimer:
    "La presente constancia se expide como evidencia de la capacitación recibida, para los fines curriculares y laborales que al interesado convengan.",
  defaultIssuedPlace: "Ciudad de Guaymas, Sonora",
} as const;

/**
 * Positions from the top of the page, in percent.
 * Font sizes are design points (scaled to template width).
 */
export const CONSTANCIA_LAYOUT = {
  leftRatio: 0.18,
  contentWidthRatio: 0.7,
  otorgaA: { top: 17.8, fontSize: 17 },
  studentName: { top: 21.6, fontSize: 30 },
  curpLabel: { top: 28.2, fontSize: 16 },
  curp: { top: 31.4, fontSize: 18 },
  courseLabel: { top: 37.6, fontSize: 16 },
  courseTitle: { top: 41.0, fontSize: 20 },
  duration: { top: 48.2, fontSize: 14 },
  modality: { top: 51.4, fontSize: 14 },
  period: { top: 54.6, fontSize: 14 },
  issuedAt: { top: 58.8, fontSize: 14 },
  instructorSignature: { top: 66.4, maxHeightRatio: 0.07, maxWidthRatio: 0.32 },
  instructorName: { top: 74.0, fontSize: 16 },
  instructorSpecialty: { top: 77.0, fontSize: 13 },
  instructorLicense: { top: 79.6, fontSize: 13 },
  instructorLogo: { top: 81.8, maxHeightRatio: 0.095, maxWidthRatio: 0.28 },
  qr: { top: 70.5, minSizeRatio: 0.16, rightRatio: 0.78 },
  folio: { top: 88.5, fontSize: 13 },
  folioRightRatio: 0.7,
  disclaimer: { top: 93.2, fontSize: 11 },
} as const;

/** Paleta oficial: azul, gris, dorado (RGB 0–1 para pdf-lib). */
export const CONSTANCIA_COLORS = {
  blue: { r: 46 / 255, g: 49 / 255, b: 146 / 255 }, // #2E3192
  gray: { r: 42 / 255, g: 42 / 255, b: 46 / 255 }, // #2A2A2E
  gold: { r: 202 / 255, g: 162 / 255, b: 75 / 255 }, // #CAA24B
  label: { r: 107 / 255, g: 107 / 255, b: 112 / 255 },
  text: { r: 42 / 255, g: 42 / 255, b: 46 / 255 },
} as const;
