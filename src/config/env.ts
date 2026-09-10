import "dotenv/config";
import path from "path";

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "7d"),
  frontendUrl: optional("FRONTEND_URL", "http://localhost:3000"),
  uploadsDir: path.resolve(process.cwd(), optional("UPLOADS_DIR", "./uploads")),
  db: {
    host: required("DB_HOST"),
    port: Number(required("DB_PORT")),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    name: required("DB_NAME"),
  },
  mail: {
    host: optional("MAIL_HOST", "smtp-relay.brevo.com"),
    port: Number(optional("MAIL_PORT", "2525")),
    user: optional("MAIL_USER"),
    pass: optional("MAIL_PASS"),
    from: optional("MAIL_FROM"),
    to: optional("MAIL_TO"),
  },
} as const;
