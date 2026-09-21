import { AppError } from "../errors/app-error";
import {
  createEvent,
  deleteEvent,
  findEventById,
  findEventsPaginated,
  findPublicEvents,
  updateEvent,
} from "../repositories/event.repository";
import type {
  CreateEventInput,
  ListEventsFilters,
  UpdateEventInput,
} from "../types/event.types";

export async function listPublicEvents() {
  return findPublicEvents();
}

export async function listAdminEvents(filters: ListEventsFilters) {
  return findEventsPaginated(filters);
}

export async function getAdminEvent(id: string) {
  const event = await findEventById(id);
  if (!event) {
    throw new AppError(404, "Evento no encontrado", "EVENT_NOT_FOUND");
  }
  return event;
}

export async function createAdminEvent(input: CreateEventInput) {
  return createEvent(input);
}

export async function updateAdminEvent(id: string, input: UpdateEventInput) {
  const event = await updateEvent(id, input);
  if (!event) {
    throw new AppError(404, "Evento no encontrado", "EVENT_NOT_FOUND");
  }
  return event;
}

export async function deleteAdminEvent(id: string) {
  const deleted = await deleteEvent(id);
  if (!deleted) {
    throw new AppError(404, "Evento no encontrado", "EVENT_NOT_FOUND");
  }
}
