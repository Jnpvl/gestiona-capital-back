import { pool } from "../config/database";
import type {
  CreateSubscriberInput,
  ListSubscribersFilters,
  PaginatedSubscribersResult,
  SubscriberListItem,
  SubscriberRecord,
  SubscriberStatus,
} from "../types/subscriber.types";

function mapListItem(row: SubscriberRecord): SubscriberListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findSubscriberByEmail(email: string): Promise<SubscriberRecord | null> {
  const { rows } = await pool.query<SubscriberRecord>(
    `SELECT * FROM newsletter_subscribers
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [email.trim()],
  );
  return rows[0] ?? null;
}

export async function createSubscriber(input: CreateSubscriberInput): Promise<SubscriberListItem> {
  const { rows } = await pool.query<SubscriberRecord>(
    `INSERT INTO newsletter_subscribers (name, email, company, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING *`,
    [
      input.name.trim(),
      input.email.trim().toLowerCase(),
      input.company?.trim() || null,
    ],
  );
  return mapListItem(rows[0]);
}

export async function reactivateSubscriber(
  id: string,
  input: CreateSubscriberInput,
): Promise<SubscriberListItem> {
  const { rows } = await pool.query<SubscriberRecord>(
    `UPDATE newsletter_subscribers SET
       name = $1,
       company = $2,
       status = 'active',
       updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [input.name.trim(), input.company?.trim() || null, id],
  );
  return mapListItem(rows[0]);
}

export async function findSubscribersPaginated(
  filters: ListSubscribersFilters = {},
): Promise<PaginatedSubscribersResult> {
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
      `(LOWER(name) LIKE $${index} OR LOWER(email) LIKE $${index} OR LOWER(COALESCE(company, '')) LIKE $${index})`,
    );
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM newsletter_subscribers ${where}`,
    values,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);

  values.push(limit, offset);
  const { rows } = await pool.query<SubscriberRecord>(
    `SELECT * FROM newsletter_subscribers
     ${where}
     ORDER BY created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  return {
    subscribers: rows.map(mapListItem),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function updateSubscriberStatus(
  id: string,
  status: SubscriberStatus,
): Promise<SubscriberListItem | null> {
  const { rows } = await pool.query<SubscriberRecord>(
    `UPDATE newsletter_subscribers SET
       status = $1,
       updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, id],
  );
  return rows[0] ? mapListItem(rows[0]) : null;
}
