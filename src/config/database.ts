import { Pool } from "pg";
import { env } from "./env";

export const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
});

pool.on("error", (error) => {
  console.error("Unexpected database error:", error);
});
