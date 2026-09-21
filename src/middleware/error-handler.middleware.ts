import type { NextFunction, Request, Response } from "express";
import multer from "multer";
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

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: {
          message:
            "El archivo es demasiado pesado. El máximo permitido es 20 MB (imágenes de curso/instructor: 5 MB).",
          code: "FILE_TOO_LARGE",
        },
      });
      return;
    }

    res.status(400).json({
      error: {
        message:
          "No se pudo procesar el archivo. Intenta con otro formato o un archivo más ligero.",
        code: error.code,
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
