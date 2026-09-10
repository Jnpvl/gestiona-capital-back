import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";
import { env } from "./config/env";
import { errorHandler } from "./middleware/error-handler.middleware";
import { apiRoutes } from "./routes";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  const allowedOrigins = new Set(
    [
      env.frontendUrl,
      "https://www.gestionach.com",
      "https://gestionach.com",
      "http://localhost:3000",
    ].filter(Boolean),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
    }),
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/uploads", express.static(env.uploadsDir));
  app.use("/templates", express.static(path.join(process.cwd(), "assets/templates")));
  app.use("/templates", express.static(path.join(process.cwd(), "assets/templates")));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", apiRoutes);

  app.use(errorHandler);

  return app;
}
