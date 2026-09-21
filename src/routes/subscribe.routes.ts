import { Router } from "express";
import { subscriberController } from "../controllers/subscriber.controller";

export const subscribeRoutes = Router();

subscribeRoutes.post("/", (req, res, next) => subscriberController.subscribe(req, res, next));
