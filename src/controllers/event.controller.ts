import type { NextFunction, Request, Response } from "express";
import {
  createAdminEvent,
  deleteAdminEvent,
  getAdminEvent,
  listAdminEvents,
  listPublicEvents,
  updateAdminEvent,
} from "../services/event.service";
import {
  createEventSchema,
  listEventsQuerySchema,
  updateEventSchema,
} from "../validators/event.validator";

function getParamId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export class EventController {
  async listPublic(_req: Request, res: Response, next: NextFunction) {
    try {
      const events = await listPublicEvents();
      res.json({ events });
    } catch (error) {
      next(error);
    }
  }

  async listAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listEventsQuerySchema.parse(req.query);
      const result = await listAdminEvents(query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const event = await getAdminEvent(getParamId(req));
      res.json({ event });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createEventSchema.parse(req.body);
      const event = await createAdminEvent(input);
      res.status(201).json({ event });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateEventSchema.parse(req.body);
      const event = await updateAdminEvent(getParamId(req), input);
      res.json({ event });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await deleteAdminEvent(getParamId(req));
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();
