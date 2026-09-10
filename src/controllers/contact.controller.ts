import type { NextFunction, Request, Response } from "express";
import { sendContactMessage } from "../services/contact.service";
import { contactMessageSchema } from "../validators/contact.validator";

export class ContactController {
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const input = contactMessageSchema.parse(req.body);
      await sendContactMessage(input);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
}

export const contactController = new ContactController();
