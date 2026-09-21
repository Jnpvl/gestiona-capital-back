export type SubscriberStatus = "active" | "unsubscribed";

export interface SubscriberRecord {
  id: string;
  name: string;
  email: string;
  company: string | null;
  status: SubscriberStatus;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriberListItem {
  id: string;
  name: string;
  email: string;
  company: string | null;
  status: SubscriberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubscriberInput {
  name: string;
  email: string;
  company?: string | null;
}

export interface ListSubscribersFilters {
  search?: string;
  status?: SubscriberStatus;
  page?: number;
  limit?: number;
}

export interface PaginatedSubscribersResult {
  subscribers: SubscriberListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
