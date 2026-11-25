import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { AppError } from "../errors/app-error";
import { generateIndividualReport } from "../services/individual-report.service";

const query = z.object({ year: z.coerce.number().int().min(2000).max(2100), guide: z.enum(["nom035_guia2", "nom035_guia3"]).optional() });
export async function individualReport(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.auth;
    if (!auth || (auth.accountType !== "company" && !(auth.accountType === "staff" && ["admin", "super_admin"].includes(auth.role ?? "")))) {
      throw new AppError(403, "No tienes acceso a reportes individuales", "FORBIDDEN");
    }
    const companyId = z.uuid().parse(auth.accountType === "company" ? auth.sub : req.params.id);
    const studentId = z.uuid().parse(req.params.studentId);
    const { year, guide } = query.parse(req.query);
    const report = await generateIndividualReport(companyId, studentId, year, guide);
    res.setHeader("Cache-Control", "private, no-store");
    res.type("application/pdf").attachment(report.filename).send(Buffer.from(report.bytes));
  } catch (error) { next(error); }
}
