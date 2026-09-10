import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isAppError } from "../errors/app-error";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        message: "Datos inválidos",
        code: "VALIDATION_ERROR",
        details: error.flatten().fieldErrors,
      },
    });
    return;
  }

  if (isAppError(error)) {
    res.status(error.statusCode).json({
      error: {
        message: error.message,
        code: error.code,
      },
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: {
      message: "Error interno del servidor",
      code: "INTERNAL_ERROR",
    },
  });
}
