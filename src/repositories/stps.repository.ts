import { pool } from "../config/database";
import type { StpsOccupationItem, StpsThematicAreaItem } from "../types/stps.types";

function normalizeSearch(search?: string): string | null {
  const trimmed = search?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export async function listStpsOccupations(
  search?: string,
  limit = 50,
): Promise<StpsOccupationItem[]> {
  const query = normalizeSearch(search);
  const values: unknown[] = [];
  let where = "";

  if (query) {
    values.push(`%${query}%`);
    const index = values.length;
    where = `WHERE LOWER(o.code) LIKE $${index} OR LOWER(o.name) LIKE $${index} OR LOWER(o.area_name) LIKE $${index}`;
  }

  values.push(Math.min(50, Math.max(1, limit)));

  const { rows } = await pool.query<{
    code: string;
    name: string;
    area_code: string;
    area_name: string;
  }>(
    `SELECT o.code, o.name, o.area_code, o.area_name
     FROM stps_occupations o
     ${where}
     ORDER BY o.area_code ASC, o.code ASC
     LIMIT $${values.length}`,
    values,
  );

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    areaCode: row.area_code,
    areaName: row.area_name,
  }));
}

export async function listStpsThematicAreas(
  search?: string,
  limit = 50,
): Promise<StpsThematicAreaItem[]> {
  const query = normalizeSearch(search);
  const values: unknown[] = [];
  let where = "";

  if (query) {
    values.push(`%${query}%`);
    const index = values.length;
    where = `WHERE LOWER(t.code) LIKE $${index} OR LOWER(t.name) LIKE $${index}`;
  }

  values.push(Math.min(50, Math.max(1, limit)));

  const { rows } = await pool.query<{ code: string; name: string }>(
    `SELECT t.code, t.name
     FROM stps_thematic_areas t
     ${where}
     ORDER BY t.code ASC
     LIMIT $${values.length}`,
    values,
  );

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
  }));
}

export async function findStpsOccupationByCode(
  code: string,
): Promise<StpsOccupationItem | null> {
  const { rows } = await pool.query<{
    code: string;
    name: string;
    area_code: string;
    area_name: string;
  }>(
    `SELECT code, name, area_code, area_name
     FROM stps_occupations
     WHERE code = $1
     LIMIT 1`,
    [code],
  );

  if (!rows[0]) return null;

  return {
    code: rows[0].code,
    name: rows[0].name,
    areaCode: rows[0].area_code,
    areaName: rows[0].area_name,
  };
}

export async function findStpsThematicAreaByCode(
  code: string,
): Promise<StpsThematicAreaItem | null> {
  const { rows } = await pool.query<{ code: string; name: string }>(
    `SELECT code, name
     FROM stps_thematic_areas
     WHERE code = $1
     LIMIT 1`,
    [code],
  );

  return rows[0] ? { code: rows[0].code, name: rows[0].name } : null;
}
