import { Router } from "express";
import { eventController } from "../controllers/event.controller";

export const eventPublicRoutes = Router();

eventPublicRoutes.get("/", (req, res, next) => eventController.listPublic(req, res, next));
