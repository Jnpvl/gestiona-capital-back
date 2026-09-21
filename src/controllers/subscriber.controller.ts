import type { NextFunction, Request, Response } from "express";
import {
  listNewsletterSubscribers,
  setSubscriberStatus,
  subscribeToNewsletter,
} from "../services/subscriber.service";
import {
  createSubscriberSchema,
  listSubscribersQuerySchema,
  updateSubscriberStatusSchema,
} from "../validators/subscriber.validator";

function getParamId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export class SubscriberController {
  async subscribe(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createSubscriberSchema.parse(req.body);
      const result = await subscribeToNewsletter({
        name: input.name,
        email: input.email,
        company: input.company,
      });
      res.status(result.alreadySubscribed ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = listSubscribersQuerySchema.parse(req.query);
      const result = await listNewsletterSubscribers(query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateSubscriberStatusSchema.parse(req.body);
      const subscriber = await setSubscriberStatus(getParamId(req), input.status);
      res.json({ subscriber });
    } catch (error) {
      next(error);
    }
  }
}

export const subscriberController = new SubscriberController();
