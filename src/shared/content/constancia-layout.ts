export const CONSTANCIA_COPY = {
  otorgaA: "Otorga a:",
  curpLabel: "Con Clave Única de Registro de Población:",
  courseLabel: "Constancia de participación",
  durationLabel: "Duración:",
  modalityLabel: "Modalidad:",
  periodLabel: "Periodo:",
  renapLabel: "RENAP CONOCER:",
  licenseLabel: "CEDULA PROFESIONAL:",
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
  leftRatio: 0.21,
  contentWidthRatio: 0.67,
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
  /** Credentials stack under specialty; width capped to stay left of QR. */
  instructorCredentials: {
    fontSize: 12,
    lineStep: 2.3,
    maxWidthRatio: 0.48,
  },
  instructorLogo: {
    gapAfterCredentials: 1.4,
    fallbackTop: 81.8,
    /** Keep logo bottom above the disclaimer with this gap (% from page top). */
    gapBeforeDisclaimer: 1.8,
    maxHeightRatio: 0.055,
    maxWidthRatio: 0.24,
  },
  /**
   * QR right edge aligns with content right (same as top logo).
   * When instructor logo exists, QR bottom aligns with that logo bottom.
   */
  /** Right edge matches top Gestiona logo (~0.934 of template width). */
  qr: { top: 70.5, minSizeRatio: 0.15, rightEdgeRatio: 0.934 },
  folio: { top: 88.5, fontSize: 13 },
  disclaimer: { top: 94.0, fontSize: 11 },
} as const;

/** Paleta oficial: azul, gris, dorado (RGB 0–1 para pdf-lib). */
export const CONSTANCIA_COLORS = {
  blue: { r: 46 / 255, g: 49 / 255, b: 146 / 255 }, // #2E3192
  gray: { r: 42 / 255, g: 42 / 255, b: 46 / 255 }, // #2A2A2E
  gold: { r: 202 / 255, g: 162 / 255, b: 75 / 255 }, // #CAA24B
  label: { r: 107 / 255, g: 107 / 255, b: 112 / 255 },
  text: { r: 42 / 255, g: 42 / 255, b: 46 / 255 },
} as const;
