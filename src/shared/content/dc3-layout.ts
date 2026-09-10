/**
 * Layout for official STPS DC-3 (Letter 612×792).
 * Positions are percent from the top / left of the page.
 *
 * Character-box centers for RFC / periodo were measured from the vector
 * tick marks in assets/templates/dc3.pdf.
 */
export const DC3_LAYOUT = {
  marginXPct: 5.0,
  contentWidthPct: 89,
  header: {
    clearTop: 2.0,
    clearBottom: 15.2,
    logoMaxHeightPct: 9.5,
    qrGapPct: 2.2,
  },
  studentName: { top: 25.55, fontSize: 10 },
  curpBoxes: {
    top: 29.04,
    fontSize: 9,
    /** 18 cell centers from CURP tick marks (+ outer borders). */
    centersXPct: [
      5.64, 7.93, 10.22, 12.59, 15.04, 17.41, 19.69, 21.98, 24.35, 26.72, 29.01, 31.29, 33.66,
      36.61, 39.46, 41.75, 44.04, 46.33,
    ],
  },
  occupation: { top: 29.04, xPct: 49.6, maxWidthPct: 45, fontSize: 8 },
  position: { top: 32.55, fontSize: 9 },
  companyName: { top: 40.05, fontSize: 9 },
  /** SHCP RFC row — mid of tick band ≈ 43.69 */
  rfcBoxes: {
    top: 43.7,
    fontSize: 9,
    centersXPct: [
      5.64, 7.93, 10.22, 12.59, 15.04, 17.41, 19.69, 21.98, 24.35, 26.72, 29.01, 31.29, 33.66,
    ],
  },
  courseTitle: { top: 50.65, fontSize: 9 },
  durationHours: { top: 53.7, xPct: 16.0, fontSize: 10 },
  /** Periodo de ejecución — mid of date tick band ≈ 53.66 */
  periodFrom: {
    top: 53.7,
    fontSize: 9,
    yearCentersXPct: [41.75, 44.37, 46.9, 49.43],
    monthCentersXPct: [52.46, 55.89],
    dayCentersXPct: [59.32, 62.75],
  },
  periodTo: {
    top: 53.7,
    fontSize: 9,
    yearCentersXPct: [69.53, 72.71, 75.9, 79.09],
    monthCentersXPct: [82.36, 85.79],
    dayCentersXPct: [89.22, 92.65],
  },
  thematicArea: { top: 57.2, fontSize: 9 },
  trainingAgent: { top: 60.45, fontSize: 9 },
  instructorSignature: { top: 64.6, xPct: 12.5, maxHeightPct: 5.6, maxWidthPct: 22 },
  instructorName: { top: 71.35, xPct: 12.5, fontSize: 8 },
  employerName: { top: 71.35, xPct: 40.5, fontSize: 8 },
  workerRepName: { top: 71.35, xPct: 68.5, fontSize: 8 },
} as const;
