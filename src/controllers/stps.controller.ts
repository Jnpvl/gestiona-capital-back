import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { stpsService } from "../services/stps.service";

const catalogQuerySchema = z.object({
  search: z.string().optional(),
});

export class StpsController {
  async listOccupations(req: Request, res: Response, next: NextFunction) {
    try {
      const { search } = catalogQuerySchema.parse(req.query);
      const result = await stpsService.listOccupations(search);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listThematicAreas(req: Request, res: Response, next: NextFunction) {
    try {
      const { search } = catalogQuerySchema.parse(req.query);
      const result = await stpsService.listThematicAreas(search);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const stpsController = new StpsController();
