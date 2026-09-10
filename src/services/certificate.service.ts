import fs from "fs/promises";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";
import {
  CONSTANCIA_COLORS,
  CONSTANCIA_COPY,
  CONSTANCIA_LAYOUT,
} from "../shared/content/constancia-layout";
import type { ConstanciaPdfData } from "../shared/content/constancia-data";
import {
  buildConstanciaQrPayload,
  formatIssuedDateLine,
} from "../shared/content/constancia-data";
import type { Dc3PdfData } from "../shared/content/dc3-data";
import { DC3_LAYOUT } from "../shared/content/dc3-layout";
import QRCode from "qrcode";

export interface CertificateData {
  studentName: string;
  courseTitle: string;
  certificateNumber: string;
  issuedAt: Date;
  companyName?: string | null;
}

const CERTIFICATE_LAYOUT = {
  studentName: { yRatio: 0.42, size: 28 },
  courseTitle: { yRatio: 0.52, size: 18 },
  completionDate: { yRatio: 0.60, size: 14 },
  certificateNumber: { yRatio: 0.68, size: 12 },
} as const;

function formatCertificateDate(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function sanitizePdfText(text: string): string {
  return text
    .replace(/·/g, "|")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function toConstanciaUpper(text: string): string {
  return sanitizePdfText(text).toLocaleUpperCase("es-MX");
}

async function embedLocalImage(pdfDoc: PDFDocument, fileUrl?: string | null) {
  if (!fileUrl) return null;
  try {
    let absolutePath: string | null = null;
    if (fileUrl.startsWith("/uploads/")) {
      absolutePath = path.join(env.uploadsDir, fileUrl.replace(/^\/uploads\//, ""));
    } else if (fileUrl.startsWith("/templates/")) {
      absolutePath = path.join(process.cwd(), "assets/templates", path.basename(fileUrl));
    }
    if (!absolutePath) return null;

    const bytes = await fs.readFile(absolutePath);
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    return isJpeg ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
  } catch {
    return null;
  }
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function yFromTop(height: number, topPercent: number, fontSize: number): number {
  return height * (1 - topPercent / 100) - fontSize * 0.35;
}

/** Baseline so glyphs sit optically centered in STPS character boxes. */
function yForBoxedChar(height: number, topPercent: number, fontSize: number): number {
  return height * (1 - topPercent / 100) - fontSize * 0.28;
}

function drawCenteredText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  centerX: number,
  y: number,
  size: number,
  color = rgb(0.12, 0.12, 0.12),
) {
  const safe = sanitizePdfText(text);
  if (!safe) return;
  const textWidth = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: centerX - textWidth / 2,
    y,
    size,
    font,
    color,
  });
}

function drawLeftText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  color = rgb(0.12, 0.12, 0.12),
) {
  const safe = sanitizePdfText(text);
  if (!safe) return;
  page.drawText(safe, { x, y, size, font, color });
}

function resolveTemplateAbsolutePath(templateUrl: string): string {
  if (templateUrl.startsWith("/templates/")) {
    const filename = path.basename(templateUrl);
    return path.join(process.cwd(), "assets/templates", filename);
  }

  if (!templateUrl.startsWith("/uploads/")) {
    throw new AppError(400, "Plantilla de constancia inválida", "INVALID_CERTIFICATE_TEMPLATE");
  }

  const relativePath = templateUrl.replace(/^\/uploads\//, "");
  return path.join(env.uploadsDir, relativePath);
}

export function createCertificateNumber(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GCH-${year}-${suffix}`;
}

export function createDc3CertificateNumber(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `GCH-DC3-${year}-${suffix}`;
}

export async function generateCertificatePdf(
  templateUrl: string,
  data: CertificateData,
): Promise<Uint8Array> {
  const absolutePath = resolveTemplateAbsolutePath(templateUrl);
  const imageBytes = await fs.readFile(absolutePath);
  const extension = path.extname(absolutePath).toLowerCase();

  const pdfDoc = await PDFDocument.create();
  let image;
  if (extension === ".png") {
    image = await pdfDoc.embedPng(imageBytes);
  } else if (extension === ".jpg" || extension === ".jpeg") {
    image = await pdfDoc.embedJpg(imageBytes);
  } else {
    throw new AppError(
      400,
      "La plantilla debe ser una imagen JPG o PNG",
      "INVALID_CERTIFICATE_TEMPLATE",
    );
  }

  const width = image.width;
  const height = image.height;
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const centerX = width / 2;
  const layout = CERTIFICATE_LAYOUT;

  drawCenteredText(
    page,
    fontBold,
    data.studentName,
    centerX,
    height * layout.studentName.yRatio,
    layout.studentName.size,
  );
  drawCenteredText(
    page,
    fontRegular,
    data.courseTitle,
    centerX,
    height * layout.courseTitle.yRatio,
    layout.courseTitle.size,
  );
  drawCenteredText(
    page,
    fontRegular,
    formatCertificateDate(data.issuedAt),
    centerX,
    height * layout.completionDate.yRatio,
    layout.completionDate.size,
  );
  drawCenteredText(
    page,
    fontRegular,
    `Folio: ${data.certificateNumber}`,
    centerX,
    height * layout.certificateNumber.yRatio,
    layout.certificateNumber.size,
  );

  return pdfDoc.save();
}

function drawBoxedChars(
  page: PDFPage,
  font: PDFFont,
  value: string,
  width: number,
  height: number,
  topPct: number,
  size: number,
  centersXPct: readonly number[],
) {
  const chars = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .padEnd(centersXPct.length, " ")
    .slice(0, centersXPct.length)
    .split("");
  for (let i = 0; i < centersXPct.length; i += 1) {
    const ch = chars[i]?.trim();
    if (!ch) continue;
    const centerX = (width * centersXPct[i]) / 100;
    const textWidth = font.widthOfTextAtSize(ch, size);
    page.drawText(ch, {
      x: centerX - textWidth / 2,
      y: yForBoxedChar(height, topPct, size),
      size,
      font,
      color: rgb(0.08, 0.08, 0.08),
    });
  }
}

export async function generateDc3Pdf(data: Dc3PdfData): Promise<Uint8Array> {
  const absolutePath = resolveTemplateAbsolutePath("/templates/dc3.pdf");
  const templateBytes = await fs.readFile(absolutePath);
  const templateDoc = await PDFDocument.load(templateBytes);
  const pdfDoc = await PDFDocument.create();
  const copied = await pdfDoc.copyPages(templateDoc, [0, 1]);
  copied.forEach((page) => pdfDoc.addPage(page));

  const page = pdfDoc.getPages()[0];
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Cover the STPS logo-placeholder instruction and place brand logo.
  const clearTopY = height * (1 - DC3_LAYOUT.header.clearTop / 100);
  const clearBottomY = height * (1 - DC3_LAYOUT.header.clearBottom / 100);
  page.drawRectangle({
    x: width * 0.03,
    y: clearBottomY,
    width: width * 0.94,
    height: clearTopY - clearBottomY,
    color: rgb(1, 1, 1),
  });

  const bandHeight = clearTopY - clearBottomY;
  const maxLogoHeight = height * (DC3_LAYOUT.header.logoMaxHeightPct / 100);
  const qrSize = Math.min(maxLogoHeight, bandHeight * 0.92);
  const qrGap = width * (DC3_LAYOUT.header.qrGapPct / 100);
  let logoWidth = 0;
  let logoHeight = 0;
  let logoImage: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;

  try {
    const logoPath = path.join(process.cwd(), "assets/templates/gch-logo.png");
    const logoBytes = await fs.readFile(logoPath);
    const isJpeg = logoBytes[0] === 0xff && logoBytes[1] === 0xd8;
    logoImage = isJpeg ? await pdfDoc.embedJpg(logoBytes) : await pdfDoc.embedPng(logoBytes);
    const scale = Math.min(maxLogoHeight / logoImage.height, (width * 0.36) / logoImage.width);
    logoWidth = logoImage.width * scale;
    logoHeight = logoImage.height * scale;
  } catch {
    // Logo is optional; QR still goes in the header.
  }

  const qrPng = await QRCode.toBuffer(
    buildConstanciaQrPayload(data.certificateNumber, env.frontendUrl),
    {
      type: "png",
      width: Math.max(220, Math.round(qrSize)),
      margin: 1,
      errorCorrectionLevel: "M",
    },
  );
  const qrImage = await pdfDoc.embedPng(qrPng);
  const groupWidth = logoWidth > 0 ? logoWidth + qrGap + qrSize : qrSize;
  const groupX = (width - groupWidth) / 2;
  const logoY = clearBottomY + (bandHeight - logoHeight) / 2;
  const qrY = clearBottomY + (bandHeight - qrSize) / 2;

  if (logoImage) {
    page.drawImage(logoImage, { x: groupX, y: logoY, width: logoWidth, height: logoHeight });
  }
  page.drawImage(qrImage, {
    x: groupX + (logoWidth > 0 ? logoWidth + qrGap : 0),
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  const drawField = (text: string, top: number, xPct: number, size: number, maxWidthPct?: number) => {
    const safe = sanitizePdfText(text);
    if (!safe) return;
    if (maxWidthPct) {
      const lines = wrapText(font, safe, size, (width * maxWidthPct) / 100);
      const startY = yFromTop(height, top, size);
      lines.slice(0, 2).forEach((line, index) => {
        drawLeftText(page, font, line, (width * xPct) / 100, startY - index * size * 1.1, size);
      });
      return;
    }
    drawLeftText(page, font, safe, (width * xPct) / 100, yFromTop(height, top, size), size);
  };

  const drawDateCluster = (
    parts: { year: string; month: string; day: string },
    cluster: {
      top: number;
      fontSize: number;
      yearCentersXPct: readonly number[];
      monthCentersXPct: readonly number[];
      dayCentersXPct: readonly number[];
    },
  ) => {
    drawBoxedChars(
      page,
      font,
      parts.year.padStart(4, "0").slice(0, 4),
      width,
      height,
      cluster.top,
      cluster.fontSize,
      cluster.yearCentersXPct,
    );
    drawBoxedChars(
      page,
      font,
      parts.month.padStart(2, "0").slice(0, 2),
      width,
      height,
      cluster.top,
      cluster.fontSize,
      cluster.monthCentersXPct,
    );
    drawBoxedChars(
      page,
      font,
      parts.day.padStart(2, "0").slice(0, 2),
      width,
      height,
      cluster.top,
      cluster.fontSize,
      cluster.dayCentersXPct,
    );
  };

  drawField(
    data.studentName,
    DC3_LAYOUT.studentName.top,
    DC3_LAYOUT.marginXPct,
    DC3_LAYOUT.studentName.fontSize,
    DC3_LAYOUT.contentWidthPct,
  );

  drawBoxedChars(
    page,
    font,
    data.curp,
    width,
    height,
    DC3_LAYOUT.curpBoxes.top,
    DC3_LAYOUT.curpBoxes.fontSize,
    DC3_LAYOUT.curpBoxes.centersXPct,
  );

  drawField(
    data.occupation,
    DC3_LAYOUT.occupation.top,
    DC3_LAYOUT.occupation.xPct,
    DC3_LAYOUT.occupation.fontSize,
    DC3_LAYOUT.occupation.maxWidthPct,
  );

  drawField(
    data.position,
    DC3_LAYOUT.position.top,
    DC3_LAYOUT.marginXPct,
    DC3_LAYOUT.position.fontSize,
    DC3_LAYOUT.contentWidthPct,
  );

  drawField(
    data.companyName,
    DC3_LAYOUT.companyName.top,
    DC3_LAYOUT.marginXPct,
    DC3_LAYOUT.companyName.fontSize,
    DC3_LAYOUT.contentWidthPct,
  );

  drawBoxedChars(
    page,
    font,
    data.companyRfc,
    width,
    height,
    DC3_LAYOUT.rfcBoxes.top,
    DC3_LAYOUT.rfcBoxes.fontSize,
    DC3_LAYOUT.rfcBoxes.centersXPct,
  );

  drawField(
    data.courseTitle,
    DC3_LAYOUT.courseTitle.top,
    DC3_LAYOUT.marginXPct,
    DC3_LAYOUT.courseTitle.fontSize,
    DC3_LAYOUT.contentWidthPct,
  );

  drawField(
    data.durationHours,
    DC3_LAYOUT.durationHours.top,
    DC3_LAYOUT.durationHours.xPct,
    DC3_LAYOUT.durationHours.fontSize,
  );

  drawDateCluster(data.periodFrom, DC3_LAYOUT.periodFrom);
  drawDateCluster(data.periodTo, DC3_LAYOUT.periodTo);

  drawField(
    data.thematicArea,
    DC3_LAYOUT.thematicArea.top,
    DC3_LAYOUT.marginXPct,
    DC3_LAYOUT.thematicArea.fontSize,
    DC3_LAYOUT.contentWidthPct,
  );

  drawField(
    data.trainingAgent,
    DC3_LAYOUT.trainingAgent.top,
    DC3_LAYOUT.marginXPct,
    DC3_LAYOUT.trainingAgent.fontSize,
    DC3_LAYOUT.contentWidthPct,
  );

  const instructorSignature = await embedLocalImage(pdfDoc, data.instructorSignatureUrl);
  if (instructorSignature) {
    const maxH = height * (DC3_LAYOUT.instructorSignature.maxHeightPct / 100);
    const maxW = width * (DC3_LAYOUT.instructorSignature.maxWidthPct / 100);
    const scale = Math.min(maxH / instructorSignature.height, maxW / instructorSignature.width);
    const sigW = instructorSignature.width * scale;
    const sigH = instructorSignature.height * scale;
    const sigTopY = height * (1 - DC3_LAYOUT.instructorSignature.top / 100);
    page.drawImage(instructorSignature, {
      x: (width * DC3_LAYOUT.instructorSignature.xPct) / 100,
      y: sigTopY - sigH,
      width: sigW,
      height: sigH,
    });
  }

  drawField(
    data.instructorName,
    DC3_LAYOUT.instructorName.top,
    DC3_LAYOUT.instructorName.xPct,
    DC3_LAYOUT.instructorName.fontSize,
    24,
  );
  drawField(
    data.employerName,
    DC3_LAYOUT.employerName.top,
    DC3_LAYOUT.employerName.xPct,
    DC3_LAYOUT.employerName.fontSize,
    24,
  );
  drawField(
    data.workerRepName,
    DC3_LAYOUT.workerRepName.top,
    DC3_LAYOUT.workerRepName.xPct,
    DC3_LAYOUT.workerRepName.fontSize,
    24,
  );

  return pdfDoc.save();
}

export async function generateConstanciaPdf(
  templateUrl: string,
  data: ConstanciaPdfData,
): Promise<Uint8Array> {
  const absolutePath = resolveTemplateAbsolutePath(templateUrl);
  const imageBytes = await fs.readFile(absolutePath);
  const extension = path.extname(absolutePath).toLowerCase();

  const pdfDoc = await PDFDocument.create();
  let image;
  if (extension === ".png") {
    image = await pdfDoc.embedPng(imageBytes);
  } else if (extension === ".jpg" || extension === ".jpeg") {
    image = await pdfDoc.embedJpg(imageBytes);
  } else {
    throw new AppError(
      400,
      "La plantilla debe ser una imagen JPG o PNG",
      "INVALID_CERTIFICATE_TEMPLATE",
    );
  }

  const width = image.width;
  const height = image.height;
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });

  pdfDoc.registerFontkit(fontkit);
  const openSansBytes = await fs.readFile(
    path.join(process.cwd(), "assets/fonts/OpenSans-Regular.ttf"),
  );
  const openSansBoldBytes = await fs.readFile(
    path.join(process.cwd(), "assets/fonts/OpenSans-SemiBold.ttf"),
  );
  const fontRegular = await pdfDoc.embedFont(openSansBytes);
  const fontBold = await pdfDoc.embedFont(openSansBoldBytes);
  const scale = width / 850;
  const blue = rgb(
    CONSTANCIA_COLORS.blue.r,
    CONSTANCIA_COLORS.blue.g,
    CONSTANCIA_COLORS.blue.b,
  );
  const gold = rgb(
    CONSTANCIA_COLORS.gold.r,
    CONSTANCIA_COLORS.gold.g,
    CONSTANCIA_COLORS.gold.b,
  );
  const label = rgb(
    CONSTANCIA_COLORS.label.r,
    CONSTANCIA_COLORS.label.g,
    CONSTANCIA_COLORS.label.b,
  );
  const text = rgb(CONSTANCIA_COLORS.text.r, CONSTANCIA_COLORS.text.g, CONSTANCIA_COLORS.text.b);
  const leftX = width * CONSTANCIA_LAYOUT.leftRatio;
  const contentWidth = width * CONSTANCIA_LAYOUT.contentWidthRatio;
  const size = (layoutSize: number) => layoutSize * scale;
  const yOf = (top: number, fontSize: number) => yFromTop(height, top, fontSize);

  const drawLabel = (copy: string, top: number, fontSize: number) => {
    drawLeftText(page, fontRegular, copy, leftX, yOf(top, size(fontSize)), size(fontSize), label);
  };

  const studentName = toConstanciaUpper(data.studentName);
  const curp = toConstanciaUpper(data.curp);
  const courseTitle = toConstanciaUpper(data.courseTitle);
  const instructorName = toConstanciaUpper(data.instructorName);

  drawLabel(CONSTANCIA_COPY.otorgaA, CONSTANCIA_LAYOUT.otorgaA.top, CONSTANCIA_LAYOUT.otorgaA.fontSize);

  const nameSize = size(CONSTANCIA_LAYOUT.studentName.fontSize);
  const nameLines = wrapText(fontRegular, studentName, nameSize, contentWidth);
  const nameStartY = yOf(CONSTANCIA_LAYOUT.studentName.top, nameSize);
  nameLines.forEach((line, index) => {
    drawLeftText(page, fontRegular, line, leftX, nameStartY - index * nameSize * 1.15, nameSize, blue);
  });

  drawLabel(CONSTANCIA_COPY.curpLabel, CONSTANCIA_LAYOUT.curpLabel.top, CONSTANCIA_LAYOUT.curpLabel.fontSize);
  drawLeftText(
    page,
    fontRegular,
    curp,
    leftX,
    yOf(CONSTANCIA_LAYOUT.curp.top, size(CONSTANCIA_LAYOUT.curp.fontSize)),
    size(CONSTANCIA_LAYOUT.curp.fontSize),
    blue,
  );

  drawLabel(
    CONSTANCIA_COPY.courseLabel,
    CONSTANCIA_LAYOUT.courseLabel.top,
    CONSTANCIA_LAYOUT.courseLabel.fontSize,
  );

  const courseSize = size(CONSTANCIA_LAYOUT.courseTitle.fontSize);
  const courseLines = wrapText(fontRegular, courseTitle, courseSize, contentWidth * 0.9);
  const courseStartY = yOf(CONSTANCIA_LAYOUT.courseTitle.top, courseSize);
  courseLines.forEach((line, index) => {
    drawLeftText(
      page,
      fontRegular,
      line,
      leftX,
      courseStartY - index * courseSize * 1.15,
      courseSize,
      blue,
    );
  });

  const detailSize = size(CONSTANCIA_LAYOUT.duration.fontSize);
  drawLeftText(
    page,
    fontRegular,
    `${CONSTANCIA_COPY.durationLabel} ${data.duration}`,
    leftX,
    yOf(CONSTANCIA_LAYOUT.duration.top, detailSize),
    detailSize,
    label,
  );
  drawLeftText(
    page,
    fontRegular,
    `${CONSTANCIA_COPY.modalityLabel} ${data.modality}`,
    leftX,
    yOf(CONSTANCIA_LAYOUT.modality.top, detailSize),
    detailSize,
    label,
  );
  drawLeftText(
    page,
    fontRegular,
    `${CONSTANCIA_COPY.periodLabel} ${data.period}`,
    leftX,
    yOf(CONSTANCIA_LAYOUT.period.top, detailSize),
    detailSize,
    label,
  );

  const issuedLine = formatIssuedDateLine(data.issuedPlace, data.issuedAt);
  const issuedSize = size(CONSTANCIA_LAYOUT.issuedAt.fontSize);
  const issuedLines = wrapText(fontRegular, issuedLine, issuedSize, contentWidth);
  const issuedStartY = yOf(CONSTANCIA_LAYOUT.issuedAt.top, issuedSize);
  issuedLines.forEach((line, index) => {
    drawLeftText(
      page,
      fontRegular,
      line,
      leftX,
      issuedStartY - index * issuedSize * 1.25,
      issuedSize,
      label,
    );
  });

  const instructorSignature = await embedLocalImage(pdfDoc, data.instructorSignatureUrl);
  if (instructorSignature) {
    const maxH = height * CONSTANCIA_LAYOUT.instructorSignature.maxHeightRatio;
    const maxW = width * CONSTANCIA_LAYOUT.instructorSignature.maxWidthRatio;
    const sigScale = Math.min(maxH / instructorSignature.height, maxW / instructorSignature.width);
    const sigW = instructorSignature.width * sigScale;
    const sigH = instructorSignature.height * sigScale;
    const sigTopY = height * (1 - CONSTANCIA_LAYOUT.instructorSignature.top / 100);
    page.drawImage(instructorSignature, {
      x: leftX,
      y: sigTopY - sigH,
      width: sigW,
      height: sigH,
    });
  }

  drawLeftText(
    page,
    fontBold,
    instructorName,
    leftX,
    yOf(CONSTANCIA_LAYOUT.instructorName.top, size(CONSTANCIA_LAYOUT.instructorName.fontSize)),
    size(CONSTANCIA_LAYOUT.instructorName.fontSize),
    text,
  );
  drawLeftText(
    page,
    fontRegular,
    data.instructorSpecialty,
    leftX,
    yOf(
      CONSTANCIA_LAYOUT.instructorSpecialty.top,
      size(CONSTANCIA_LAYOUT.instructorSpecialty.fontSize),
    ),
    size(CONSTANCIA_LAYOUT.instructorSpecialty.fontSize),
    label,
  );
  drawLeftText(
    page,
    fontRegular,
    data.instructorLicense,
    leftX,
    yOf(CONSTANCIA_LAYOUT.instructorLicense.top, size(CONSTANCIA_LAYOUT.instructorLicense.fontSize)),
    size(CONSTANCIA_LAYOUT.instructorLicense.fontSize),
    label,
  );

  const instructorLogo = await embedLocalImage(pdfDoc, data.instructorLogoUrl);
  if (instructorLogo) {
    const maxH = height * CONSTANCIA_LAYOUT.instructorLogo.maxHeightRatio;
    const maxW = width * CONSTANCIA_LAYOUT.instructorLogo.maxWidthRatio;
    const logoScale = Math.min(maxH / instructorLogo.height, maxW / instructorLogo.width);
    const logoW = instructorLogo.width * logoScale;
    const logoH = instructorLogo.height * logoScale;
    const logoTopY = height * (1 - CONSTANCIA_LAYOUT.instructorLogo.top / 100);
    page.drawImage(instructorLogo, {
      x: leftX,
      y: logoTopY - logoH,
      width: logoW,
      height: logoH,
    });
  }

  const folioText = `${CONSTANCIA_COPY.folioLabel} ${data.certificateNumber}`;
  const folioSize = size(CONSTANCIA_LAYOUT.folio.fontSize);
  const folioWidth = fontRegular.widthOfTextAtSize(sanitizePdfText(folioText), folioSize);
  const qrSize = Math.max(folioWidth * 1.05, width * CONSTANCIA_LAYOUT.qr.minSizeRatio);
  const qrCenterX = width * CONSTANCIA_LAYOUT.qr.rightRatio;
  const qrX = qrCenterX - qrSize / 2;
  const qrTopY = height * (1 - CONSTANCIA_LAYOUT.qr.top / 100);
  const qrY = qrTopY - qrSize;
  const qrPng = await QRCode.toBuffer(
    buildConstanciaQrPayload(data.certificateNumber, env.frontendUrl),
    {
      type: "png",
      width: Math.max(220, Math.round(qrSize)),
      margin: 1,
      errorCorrectionLevel: "M",
    },
  );
  const qrImage = await pdfDoc.embedPng(qrPng);
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  const folioY = Math.max(qrY - folioSize * 1.6, height * 0.08);
  drawLeftText(
    page,
    fontRegular,
    folioText,
    qrCenterX - folioWidth / 2,
    folioY,
    folioSize,
    gold,
  );

  const disclaimerSize = size(CONSTANCIA_LAYOUT.disclaimer.fontSize);
  const disclaimerLines = wrapText(
    fontRegular,
    CONSTANCIA_COPY.disclaimer,
    disclaimerSize,
    contentWidth,
  );
  const disclaimerStartY = yOf(CONSTANCIA_LAYOUT.disclaimer.top, disclaimerSize);
  disclaimerLines.forEach((line, index) => {
    drawLeftText(
      page,
      fontRegular,
      line,
      leftX,
      disclaimerStartY - index * disclaimerSize * 1.35,
      disclaimerSize,
      label,
    );
  });

  return pdfDoc.save();
}
