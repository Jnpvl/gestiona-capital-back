import { pool } from "../config/database";
import type {
  CreateEventInput,
  EventListItem,
  EventPublicItem,
  EventRecord,
  ListEventsFilters,
  PaginatedEventsResult,
  UpdateEventInput,
} from "../types/event.types";

function mapListItem(row: EventRecord): EventListItem {
  return {
    id: row.id,
    title: row.title,
    eventType: row.event_type,
    modality: row.modality,
    dateLabel: row.date_label,
    description: row.description,
    status: row.status,
    isVisible: row.is_visible,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapPublicItem(row: EventRecord): EventPublicItem {
  return {
    id: row.id,
    title: row.title,
    eventType: row.event_type,
    modality: row.modality,
    dateLabel: row.date_label,
    description: row.description,
  };
}

export async function findPublicEvents(): Promise<EventPublicItem[]> {
  const { rows } = await pool.query<EventRecord>(
    `SELECT * FROM events
     WHERE status = 'published' AND is_visible = TRUE
     ORDER BY sort_order ASC, created_at DESC`,
  );
  return rows.map(mapPublicItem);
}

export async function findEventsPaginated(
  filters: ListEventsFilters = {},
): Promise<PaginatedEventsResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`status = $${values.length}`);
  }

  if (filters.search?.trim()) {
    values.push(`%${filters.search.trim().toLowerCase()}%`);
    const index = values.length;
    conditions.push(
      `(LOWER(title) LIKE $${index} OR LOWER(event_type) LIKE $${index} OR LOWER(description) LIKE $${index})`,
    );
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM events ${where}`,
    values,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(limit, offset);
  const { rows } = await pool.query<EventRecord>(
    `SELECT * FROM events
     ${where}
     ORDER BY sort_order ASC, created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  return {
    events: rows.map(mapListItem),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function findEventById(id: string): Promise<EventListItem | null> {
  const { rows } = await pool.query<EventRecord>(
    "SELECT * FROM events WHERE id = $1 LIMIT 1",
    [id],
  );
  return rows[0] ? mapListItem(rows[0]) : null;
}

export async function createEvent(input: CreateEventInput): Promise<EventListItem> {
  const { rows } = await pool.query<EventRecord>(
    `INSERT INTO events (
       title, event_type, modality, date_label, description, status, is_visible, sort_order
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.title.trim(),
      input.eventType.trim(),
      input.modality.trim(),
      input.dateLabel.trim(),
      input.description.trim(),
      input.status ?? "draft",
      input.isVisible ?? true,
      input.sortOrder ?? 0,
    ],
  );
  return mapListItem(rows[0]);
}

export async function updateEvent(
  id: string,
  input: UpdateEventInput,
): Promise<EventListItem | null> {
  const current = await findEventById(id);
  if (!current) return null;

  const { rows } = await pool.query<EventRecord>(
    `UPDATE events SET
       title = $1,
       event_type = $2,
       modality = $3,
       date_label = $4,
       description = $5,
       status = $6,
       is_visible = $7,
       sort_order = $8,
       updated_at = NOW()
     WHERE id = $9
     RETURNING *`,
    [
      input.title?.trim() ?? current.title,
      input.eventType?.trim() ?? current.eventType,
      input.modality?.trim() ?? current.modality,
      input.dateLabel?.trim() ?? current.dateLabel,
      input.description?.trim() ?? current.description,
      input.status ?? current.status,
      input.isVisible ?? current.isVisible,
      input.sortOrder ?? current.sortOrder,
      id,
    ],
  );

  return rows[0] ? mapListItem(rows[0]) : null;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM events WHERE id = $1", [id]);
  return (result.rowCount ?? 0) > 0;
}
