import fs from "node:fs";
import path from "node:path";
import { pool } from "../config/database";

function isEnumValueMigration(sql: string): boolean {
  return /ALTER\s+TYPE\s+\w+\s+ADD\s+VALUE/i.test(sql);
}

async function migrate() {
  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const { rows } = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [file],
      );

      if (rows.length > 0) {
        console.log(`Skipped (already applied): ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

      // ADD VALUE no puede vivir dentro de una transacción en varios PostgreSQL.
      if (isEnumValueMigration(sql)) {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        console.log(`Applied: ${file}`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Applied: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("Migrations completed.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
