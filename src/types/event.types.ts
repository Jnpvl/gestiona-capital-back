export type EventStatus = "draft" | "published";

export interface EventRecord {
  id: string;
  title: string;
  event_type: string;
  modality: string;
  date_label: string;
  description: string;
  status: EventStatus;
  is_visible: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface EventListItem {
  id: string;
  title: string;
  eventType: string;
  modality: string;
  dateLabel: string;
  description: string;
  status: EventStatus;
  isVisible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventPublicItem {
  id: string;
  title: string;
  eventType: string;
  modality: string;
  dateLabel: string;
  description: string;
}

export interface CreateEventInput {
  title: string;
  eventType: string;
  modality: string;
  dateLabel: string;
  description: string;
  status?: EventStatus;
  isVisible?: boolean;
  sortOrder?: number;
}

export interface UpdateEventInput {
  title?: string;
  eventType?: string;
  modality?: string;
  dateLabel?: string;
  description?: string;
  status?: EventStatus;
  isVisible?: boolean;
  sortOrder?: number;
}

export interface ListEventsFilters {
  search?: string;
  status?: EventStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedEventsResult {
  events: EventListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
