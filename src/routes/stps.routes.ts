import { Router } from "express";
import { stpsController } from "../controllers/stps.controller";
import { authenticate, requireStaff } from "../middleware/auth.middleware";

const staffAuth = [authenticate, requireStaff()];

export const stpsRoutes = Router();

stpsRoutes.get("/occupations", ...staffAuth, (req, res, next) =>
  stpsController.listOccupations(req, res, next),
);

stpsRoutes.get("/thematic-areas", ...staffAuth, (req, res, next) =>
  stpsController.listThematicAreas(req, res, next),
);
