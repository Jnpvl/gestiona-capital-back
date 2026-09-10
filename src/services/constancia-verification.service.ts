import { pool } from "../config/database";
import { AppError } from "../errors/app-error";
import { formatDateEsMx, formatOnlinePeriod } from "../shared/content/constancia-data";
import { CONSTANCIA_COPY } from "../shared/content/constancia-layout";

export interface PublicConstanciaVerification {
  valid: true;
  folio: string;
  issuedAt: string | null;
  studentName: string;
  curp: string | null;
  courseTitle: string;
  duration: string | null;
  modality: string;
  period: string;
  location: string;
  instructorName: string | null;
  instructorSpecialty: string | null;
}

export class ConstanciaVerificationService {
  async verifyByFolio(folioRaw: string): Promise<PublicConstanciaVerification> {
    const folio = folioRaw.trim().toUpperCase();
    if (!folio) {
      throw new AppError(400, "Folio inválido", "INVALID_FOLIO");
    }

    const { rows } = await pool.query<{
      certificate_number: string;
      certificate_issued_at: Date | null;
      student_name: string;
      curp: string | null;
      course_title: string;
      duration: string | null;
      location: string | null;
      course_period: string | null;
      delivery_mode: "online" | "presencial";
      enrolled_at: Date;
      completed_at: Date | null;
      instructor_name: string | null;
      instructor_career: string | null;
      instructor_area: string | null;
    }>(
      `SELECT ep.certificate_number,
              ep.certificate_issued_at,
              s.name AS student_name,
              s.curp,
              c.title AS course_title,
              c.duration,
              c.location,
              c.period AS course_period,
              e.delivery_mode,
              e.enrolled_at,
              e.completed_at,
              st.name AS instructor_name,
              st.career AS instructor_career,
              st.professional_area AS instructor_area
       FROM enrollment_progress ep
       INNER JOIN enrollments e ON e.id = ep.enrollment_id
       INNER JOIN students s ON s.id = e.student_id
       INNER JOIN courses c ON c.id = e.course_id
       LEFT JOIN staff st ON st.id = c.instructor_id
       WHERE UPPER(ep.certificate_number) = $1
         AND e.status = 'active'
       LIMIT 1`,
      [folio],
    );

    const row = rows[0];
    if (!row) {
      throw new AppError(404, "Constancia no encontrada", "CONSTANCIA_NOT_FOUND");
    }

    const modality = row.delivery_mode === "presencial" ? "Presencial" : "En línea";
    let period = row.course_period?.trim() || "—";
    if (row.enrolled_at && row.completed_at) {
      period = formatOnlinePeriod(row.enrolled_at, row.completed_at);
    }

    return {
      valid: true,
      folio: row.certificate_number,
      issuedAt: row.certificate_issued_at
        ? formatDateEsMx(row.certificate_issued_at)
        : null,
      studentName: row.student_name,
      curp: row.curp,
      courseTitle: row.course_title,
      duration: row.duration,
      modality,
      period,
      location: row.location?.trim() || CONSTANCIA_COPY.defaultIssuedPlace,
      instructorName: row.instructor_name,
      instructorSpecialty:
        row.instructor_area?.trim() || row.instructor_career?.trim() || null,
    };
  }
}

export const constanciaVerificationService = new ConstanciaVerificationService();
