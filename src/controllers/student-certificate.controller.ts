import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/app-error";
import { studentCertificateService } from "../services/student-certificate.service";

export class StudentCertificateController {
  async downloadCertificate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }

      const slug = String(req.params.slug);
      const { pdfBytes, filename } = await studentCertificateService.downloadCertificate(
        req.auth.sub,
        slug,
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      next(error);
    }
  }

  async downloadDc3Certificate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth) {
        throw new AppError(401, "No autorizado", "UNAUTHORIZED");
      }

      const slug = String(req.params.slug);
      const { pdfBytes, filename } = await studentCertificateService.downloadDc3Certificate(
        req.auth.sub,
        slug,
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      next(error);
    }
  }
}

export const studentCertificateController = new StudentCertificateController();
