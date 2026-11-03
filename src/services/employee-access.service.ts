import bcrypt from "bcrypt";
import crypto from "crypto";
import { pool } from "../config/database";
import { AppError } from "../errors/app-error";
import { findCompanyById } from "../repositories/company.repository";
import { sendStudentWelcomeEmail } from "./notification.service";

export interface SendAccessInput {
  studentIds?: string[];
  all?: boolean;
  activateInactive?: boolean;
  /** Solo cuenta (para el diálogo de confirmación); no cambia nada. */
  dryRun?: boolean;
}

type ResultStatus = "sent" | "skipped" | "failed";
interface EmployeeResult {
  studentId: string;
  name: string;
  email: string;
  status: ResultStatus;
  reason?: string;
  activated?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Envía el correo de accesos a empleados de UNA empresa. Como las contraseñas están
 * hasheadas, se genera una nueva por empleado (la anterior deja de funcionar).
 * Uno por uno (amigable con el SMTP). Si el correo falla, la contraseña NO cambia.
 */
export class EmployeeAccessService {
  async send(companyId: string, input: SendAccessInput) {
    const company = await findCompanyById(companyId);
    if (!company) throw new AppError(404, "Empresa no encontrada", "COMPANY_NOT_FOUND");

    const { rows } = await pool.query<{ id: string; name: string; email: string | null; active: boolean }>(
      `SELECT id, name, email, active FROM students
        WHERE company_id = $1 ${input.all ? "" : "AND id = ANY($2::uuid[])"}
        ORDER BY name`,
      input.all ? [companyId] : [companyId, input.studentIds ?? []],
    );
    if (!input.all && rows.length !== new Set(input.studentIds).size) {
      throw new AppError(400, "Empleados: algunos no pertenecen a esta empresa", "VALIDATION_ERROR", [
        { field: "studentIds", label: "Empleados", message: "algunos no pertenecen a esta empresa" },
      ]);
    }

    const inactive = rows.filter((r) => !r.active).length;
    const withoutEmail = rows.filter((r) => !r.email || !EMAIL_RE.test(r.email)).length;
    if (input.dryRun) {
      return { total: rows.length, inactive, withoutEmail };
    }

    const results: EmployeeResult[] = [];
    for (const r of rows) {
      const base = { studentId: r.id, name: r.name, email: r.email ?? "" };
      if (!r.email || !EMAIL_RE.test(r.email)) {
        results.push({ ...base, status: "failed", reason: "Sin correo válido" });
        continue;
      }
      if (!r.active && !input.activateInactive) {
        results.push({ ...base, status: "skipped", reason: "Empleado inactivo" });
        continue;
      }
      const password = crypto.randomBytes(9).toString("base64url");
      const hash = await bcrypt.hash(password, 10);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE students
              SET password_hash = $2, access_email_sent_at = NOW(),
                  active = CASE WHEN $3 THEN TRUE ELSE active END, updated_at = NOW()
            WHERE id = $1`,
          [r.id, hash, !r.active && !!input.activateInactive],
        );
        await sendStudentWelcomeEmail({ name: r.name, email: r.email, password });
        await client.query("COMMIT");
        results.push({ ...base, status: "sent", activated: !r.active || undefined });
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        console.error("[mail] accesos empleado", r.id, error);
        results.push({
          ...base,
          status: "failed",
          reason: error instanceof AppError ? error.message : "No se pudo enviar el correo",
        });
      } finally {
        client.release();
      }
    }
    const count = (s: ResultStatus) => results.filter((x) => x.status === s).length;
    return {
      total: rows.length,
      sent: count("sent"),
      skipped: count("skipped"),
      failed: count("failed"),
      activated: results.filter((x) => x.activated).length,
      results,
    };
  }
}

export const employeeAccessService = new EmployeeAccessService();
