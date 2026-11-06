/**
 * Layout for official STPS DC-3 (Letter 612×792).
 * Positions are percent from the top / left of the page.
 *
 * Template: assets/templates/dc3.pdf (logo baked in; QR drawn on the right).
 * Vertical tops and box centers measured against the new template.
 */
export const DC3_LAYOUT = {
  marginXPct: 5.0,
  contentWidthPct: 89,
  header: {
    qrTop: 2.4,
    qrSizePct: 9.2,
    qrRightInsetPct: 4.5,
    /** Folio centered under the QR. */
    folioGapPct: 0.45,
    folioFontSize: 7,
  },
  /** Name cell ~19.0–24.7 */
  studentName: { top: 23.5, fontSize: 10 },
  curpBoxes: {
    /** CURP / occupation row ~24.7–31.3 */
    top: 27.4,
    fontSize: 9,
    centersXPct: [
      5.12, 7.91, 10.23, 12.64, 15.03, 17.32, 19.64, 21.97, 24.27, 26.59, 28.91, 31.2, 33.53,
      36.45, 39.33, 41.64, 43.97, 46.8,
    ],
  },
  occupation: { top: 27.4, xPct: 49.6, maxWidthPct: 45, fontSize: 8 },
  /** Puesto cell ~31.3–33.4 */
  position: { top: 30.0, fontSize: 9 },
  /** Company name ~33.4–39.1 */
  companyName: { top: 37.6, fontSize: 9 },
  rfcBoxes: {
    /** RFC boxes ~39.1–42.5 */
    top: 41.2,
    fontSize: 9,
    centersXPct: [
      5.63, 7.91, 10.23, 12.64, 15.03, 17.32, 19.64, 21.97, 24.27, 26.59, 28.91, 31.2, 33.53,
    ],
  },
  /** Course name ~44.6–49.1 */
  courseTitle: { top: 48.0, fontSize: 9 },
  /** Duration / period ~49.1–52.2 */
  durationHours: { top: 51.4, xPct: 16.0, fontSize: 10 },
  periodFrom: {
    top: 51.4,
    fontSize: 9,
    yearCentersXPct: [41.77, 44.39, 47.0, 49.61],
    monthCentersXPct: [52.46, 55.89],
    dayCentersXPct: [59.32, 62.75],
  },
  periodTo: {
    top: 51.4,
    fontSize: 9,
    yearCentersXPct: [69.88, 73.06, 76.23, 79.5],
    monthCentersXPct: [82.36, 85.79],
    dayCentersXPct: [89.22, 92.65],
  },
  /** Thematic area ~52.2–55.3 */
  thematicArea: { top: 54.5, fontSize: 9 },
  /** Training agent ~55.3–58.4 */
  trainingAgent: { top: 57.2, fontSize: 9 },
  signatureColumns: {
    widthPct: 26,
    instructorCenterXPct: 21.5,
    employerCenterXPct: 50.0,
    workerRepCenterXPct: 78.5,
  },
  instructorSignature: {
    /** Signature line ≈ 70.2 */
    top: 61.5,
    preferredHeightPct: 10.5,
    preferredWidthPct: 28,
    bottomGapPct: 0.9,
  },
  /** Just above the signature line (~70.2). */
  instructorName: { top: 69.2, fontSize: 8, minFontSize: 6 },
  employerName: { top: 69.2, fontSize: 8, minFontSize: 6 },
  workerRepName: { top: 69.2, fontSize: 8, minFontSize: 6 },
} as const;
