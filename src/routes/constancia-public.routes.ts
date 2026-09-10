import { Router } from "express";
import { constanciaPublicController } from "../controllers/constancia-public.controller";

export const constanciaPublicRoutes = Router();

constanciaPublicRoutes.get("/:folio", (req, res, next) =>
  constanciaPublicController.verify(req, res, next),
);
