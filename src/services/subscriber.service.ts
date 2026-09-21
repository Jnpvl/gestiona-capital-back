import { AppError } from "../errors/app-error";
import {
  createSubscriber,
  findSubscriberByEmail,
  findSubscribersPaginated,
  reactivateSubscriber,
  updateSubscriberStatus,
} from "../repositories/subscriber.repository";
import type {
  CreateSubscriberInput,
  ListSubscribersFilters,
  SubscriberStatus,
} from "../types/subscriber.types";

export async function subscribeToNewsletter(input: CreateSubscriberInput) {
  const existing = await findSubscriberByEmail(input.email);

  if (existing?.status === "active") {
    return {
      subscriber: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        company: existing.company,
        status: existing.status,
        createdAt: existing.created_at.toISOString(),
        updatedAt: existing.updated_at.toISOString(),
      },
      alreadySubscribed: true as const,
    };
  }

  if (existing) {
    const subscriber = await reactivateSubscriber(existing.id, input);
    return { subscriber, alreadySubscribed: false as const, reactivated: true as const };
  }

  const subscriber = await createSubscriber(input);
  return { subscriber, alreadySubscribed: false as const, reactivated: false as const };
}

export async function listNewsletterSubscribers(filters: ListSubscribersFilters) {
  return findSubscribersPaginated(filters);
}

export async function setSubscriberStatus(id: string, status: SubscriberStatus) {
  const subscriber = await updateSubscriberStatus(id, status);
  if (!subscriber) {
    throw new AppError(404, "Suscriptor no encontrado", "SUBSCRIBER_NOT_FOUND");
  }
  return subscriber;
}
