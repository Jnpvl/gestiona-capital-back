import { Router } from "express";
import { contactController } from "../controllers/contact.controller";

export const contactRoutes = Router();

contactRoutes.post("/", (req, res, next) => contactController.submit(req, res, next));
