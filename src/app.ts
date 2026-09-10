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
  app.use(
    cors({
      origin: env.frontendUrl,
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
