import JSZip from "jszip";
import { AppError } from "../errors/app-error";
import { findCourseById } from "../repositories/course.repository";
import { findCourseEnrollments } from "../repositories/student.repository";
import type { EnrollmentDeliveryMode } from "../types/student.types";
import { studentCertificateService } from "./student-certificate.service";

export type CourseDocumentExportKind = "constancia" | "dc3";

export async function buildCourseCertificatesZip(
  courseId: string,
  options: {
    deliveryMode?: EnrollmentDeliveryMode | "all";
    enrollmentIds?: string[];
    kind?: CourseDocumentExportKind;
  } = {},
): Promise<{ buffer: Buffer; filename: string; count: number }> {
  const course = await findCourseById(courseId);
  if (!course) {
    throw new AppError(404, "Curso no encontrado", "COURSE_NOT_FOUND");
  }

  const kind = options.kind ?? "constancia";
  const deliveryMode = options.deliveryMode ?? "all";
  const enrollments = await findCourseEnrollments(courseId);
  const idSet =
    options.enrollmentIds && options.enrollmentIds.length > 0
      ? new Set(options.enrollmentIds)
      : null;

  const filtered = enrollments.filter((item) => {
    if (kind === "dc3" ? !item.canDownloadDc3 : !item.canDownloadCertificate) return false;
    if (idSet && !idSet.has(item.id)) return false;
    if (deliveryMode !== "all" && item.deliveryMode !== deliveryMode) return false;
    return true;
  });

  if (filtered.length === 0) {
    throw new AppError(
      400,
      kind === "dc3"
        ? "No hay DC3 listos para exportar con ese filtro"
        : "No hay constancias listas para exportar con ese filtro",
      kind === "dc3" ? "NO_DC3" : "NO_CERTIFICATES",
    );
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const enrollment of filtered) {
    const { pdfBytes, filename: preferredName } =
      kind === "dc3"
        ? await studentCertificateService.downloadDc3ForEnrollment(courseId, enrollment.id)
        : await studentCertificateService.downloadCertificateForEnrollment(
            courseId,
            enrollment.id,
          );
    const base = preferredName.replace(/\.pdf$/i, "");
    let filename = `${base}.pdf`;
    let suffix = 1;
    while (usedNames.has(filename)) {
      filename = `${base}-${suffix}.pdf`;
      suffix += 1;
    }
    usedNames.add(filename);
    zip.file(filename, Buffer.from(pdfBytes));
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  const modeSuffix =
    deliveryMode && deliveryMode !== "all" ? `-${deliveryMode}` : "";
  const prefix = kind === "dc3" ? "dc3" : "constancias";

  return {
    buffer,
    filename: `${prefix}-${course.slug}${modeSuffix}.zip`,
    count: filtered.length,
  };
}
