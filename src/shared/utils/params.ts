import type { Request } from "express";

export function getParamId(req: Request): string {
  const id = req.params.id;
  if (Array.isArray(id)) return id[0];
  if (!id) {
    throw new Error("Missing route parameter: id");
  }
  return id;
}
