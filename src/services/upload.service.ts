import fs from "fs/promises";
import path from "path";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";

export type CourseAssetKind = "image" | "pdf";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const PDF_MIME_TYPES = new Set(["application/pdf"]);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

function sanitizeSlug(slug: string): string {
  return slug
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "curso";
}

function sanitizeFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const base = path
    .basename(filename, ext)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "archivo"}${ext}`;
}

function getKindConfig(kind: CourseAssetKind) {
  if (kind === "image") {
    return {
      subdir: "images/cursos",
      mimeTypes: IMAGE_MIME_TYPES,
      maxBytes: MAX_IMAGE_BYTES,
      defaultExt: ".jpg",
    };
  }

  return {
    subdir: "files/cursos",
    mimeTypes: PDF_MIME_TYPES,
    maxBytes: MAX_PDF_BYTES,
    defaultExt: ".pdf",
  };
}

export async function saveCourseAsset(
  courseSlug: string,
  kind: CourseAssetKind,
  file: Express.Multer.File,
): Promise<string> {
  const config = getKindConfig(kind);

  if (!config.mimeTypes.has(file.mimetype)) {
    throw new AppError(400, "Tipo de archivo no permitido", "INVALID_FILE_TYPE");
  }

  if (file.size > config.maxBytes) {
    throw new AppError(400, "El archivo excede el tamaño permitido", "FILE_TOO_LARGE");
  }

  const folderSlug = sanitizeSlug(courseSlug);
  const directory = path.join(env.uploadsDir, config.subdir, folderSlug);
  await fs.mkdir(directory, { recursive: true });

  const originalName = file.originalname || `archivo${config.defaultExt}`;
  const filename = `${Date.now()}-${sanitizeFilename(originalName)}`;
  const absolutePath = path.join(directory, filename);

  await fs.writeFile(absolutePath, file.buffer);

  return `/uploads/${config.subdir}/${folderSlug}/${filename}`;
}

export type StaffImageKind = "photo" | "logo" | "signature";

export function staffUploadFolder(staff: {
  id: string;
  name: string;
  first_names?: string | null;
  paternal_last_name?: string | null;
}): string {
  const label =
    [staff.paternal_last_name, staff.first_names].filter((part) => part?.trim()).join(" ") ||
    staff.name ||
    "instructor";

  return `${sanitizeSlug(label)}-${staff.id.replace(/-/g, "").slice(0, 8)}`;
}

export async function saveStaffImage(
  staff: {
    id: string;
    name: string;
    first_names?: string | null;
    paternal_last_name?: string | null;
  },
  file: Express.Multer.File,
  kind: StaffImageKind = "photo",
): Promise<string> {
  if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(400, "Tipo de archivo no permitido", "INVALID_FILE_TYPE");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new AppError(400, "El archivo excede el tamaño permitido", "FILE_TOO_LARGE");
  }

  const folder = staffUploadFolder(staff);
  const directory = path.join(env.uploadsDir, "images/staff", folder);
  await fs.mkdir(directory, { recursive: true });

  const prefix = kind === "logo" ? "logo" : kind === "signature" ? "firma" : "foto";
  const originalName = file.originalname || `${prefix}.jpg`;
  const filename = `${prefix}-${Date.now()}-${sanitizeFilename(originalName)}`;
  const absolutePath = path.join(directory, filename);

  await fs.writeFile(absolutePath, file.buffer);

  return `/uploads/images/staff/${folder}/${filename}`;
}

const ASSIGNMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_ASSIGNMENT_BYTES = 20 * 1024 * 1024;

export async function saveAssignmentSubmissionFile(input: {
  courseSlug: string;
  studentId: string;
  blockId: string;
  file: Express.Multer.File;
}): Promise<{ path: string; fileName: string }> {
  if (!ASSIGNMENT_MIME_TYPES.has(input.file.mimetype)) {
    throw new AppError(
      400,
      "Tipo de archivo no permitido. Usa PDF o imagen (JPG, PNG, WEBP).",
      "INVALID_FILE_TYPE",
    );
  }

  if (input.file.size > MAX_ASSIGNMENT_BYTES) {
    throw new AppError(400, "El archivo excede el tamaño permitido (20 MB)", "FILE_TOO_LARGE");
  }

  const folderSlug = sanitizeSlug(input.courseSlug);
  const studentFolder = input.studentId.replace(/-/g, "").slice(0, 12);
  const blockFolder = input.blockId.replace(/-/g, "").slice(0, 12);
  const directory = path.join(
    env.uploadsDir,
    "tareas",
    folderSlug,
    studentFolder,
    blockFolder,
  );
  await fs.mkdir(directory, { recursive: true });

  const originalName = input.file.originalname || "entrega.pdf";
  const fileName = sanitizeFilename(originalName);
  const storedName = `${Date.now()}-${fileName}`;
  const absolutePath = path.join(directory, storedName);

  await fs.writeFile(absolutePath, input.file.buffer);

  return {
    path: `/uploads/tareas/${folderSlug}/${studentFolder}/${blockFolder}/${storedName}`,
    fileName,
  };
}

export async function saveStaffPhoto(
  staff: {
    id: string;
    name: string;
    first_names?: string | null;
    paternal_last_name?: string | null;
  },
  file: Express.Multer.File,
): Promise<string> {
  return saveStaffImage(staff, file, "photo");
}
