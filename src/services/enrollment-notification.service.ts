import type { Attachment } from "nodemailer";
import { findEnrollmentNotificationContext } from "../repositories/student.repository";
import {
  notifySafely,
  sendCourseCompletedEmail,
} from "./notification.service";
import { studentCertificateService } from "./student-certificate.service";

function toPdfAttachment(file: { pdfBytes: Uint8Array; filename: string }): Attachment {
  return {
    filename: file.filename,
    content: Buffer.from(file.pdfBytes),
    contentType: "application/pdf",
  };
}

export async function notifyEnrollmentCompleted(enrollmentId: string): Promise<void> {
  await notifySafely(async () => {
    const context = await findEnrollmentNotificationContext(enrollmentId);
    if (!context?.studentEmail) return;

    const attachments: Attachment[] = [];

    try {
      const constancia = await studentCertificateService.downloadCertificateForEnrollment(
        context.courseId,
        context.enrollmentId,
      );
      attachments.push(toPdfAttachment(constancia));
    } catch (error) {
      console.error("[mail] No se pudo adjuntar la constancia:", error);
    }

    if (context.enrolledViaCompany) {
      try {
        const dc3 = await studentCertificateService.downloadDc3ForEnrollment(
          context.courseId,
          context.enrollmentId,
        );
        attachments.push(toPdfAttachment(dc3));
      } catch (error) {
        console.error("[mail] No se pudo adjuntar el DC-3:", error);
      }
    }

    await sendCourseCompletedEmail({
      name: context.studentName,
      email: context.studentEmail,
      courseTitle: context.courseTitle,
      courseSlug: context.courseSlug,
      attachments,
    });
  });
}
