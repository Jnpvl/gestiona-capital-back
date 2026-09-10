import type { NextFunction, Request, Response } from "express";
import { constanciaVerificationService } from "../services/constancia-verification.service";

function getFolio(req: Request): string {
  const folio = req.params.folio;
  return Array.isArray(folio) ? folio[0] : folio;
}

export class ConstanciaPublicController {
  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await constanciaVerificationService.verifyByFolio(getFolio(req));
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const constanciaPublicController = new ConstanciaPublicController();
