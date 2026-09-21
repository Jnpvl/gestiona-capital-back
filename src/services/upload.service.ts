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

/**
 * Deletes a file under uploads/ safely.
 * @returns true if the file was removed or was already missing; false if path was invalid.
 */
export async function deleteManagedUpload(publicPath?: string | null): Promise<boolean> {
  if (!publicPath?.trim()) return false;

  let normalized = publicPath.trim().split("?")[0];

  // Full URL → pathname
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      normalized = new URL(normalized).pathname;
    } catch {
      return false;
    }
  }

  // Legacy paths without /uploads prefix
  if (normalized.startsWith("/images/") || normalized.startsWith("/files/")) {
    normalized = `/uploads${normalized}`;
  }

  if (!normalized.startsWith("/uploads/")) return false;

  const relative = normalized.slice("/uploads/".length);
  if (!relative || relative.includes("..") || path.isAbsolute(relative)) return false;

  const uploadsRoot = path.resolve(env.uploadsDir);
  const absolutePath = path.resolve(uploadsRoot, relative);
  if (absolutePath !== uploadsRoot && !absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return false;
  }

  try {
    await fs.unlink(absolutePath);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return true;
    throw new AppError(
      500,
      `No se pudo eliminar el archivo en el servidor: ${absolutePath}`,
      "UPLOAD_DELETE_FAILED",
    );
  }
}

/** Best-effort batch delete; never throws for individual failures. */
export async function deleteManagedUploadsSafe(paths: Array<string | null | undefined>): Promise<void> {
  const unique = [
    ...new Set(paths.map((path) => path?.trim()).filter((path): path is string => Boolean(path))),
  ];

  await Promise.all(
    unique.map(async (path) => {
      try {
        await deleteManagedUpload(path);
      } catch {
        // Ignore leftovers that cannot be removed.
      }
    }),
  );
}

/**
 * Deletes on-disk upload trees for a course slug
 * (images/cursos, files/cursos, and student tareas).
 */
export async function deleteCourseUploadTrees(courseSlug: string): Promise<void> {
  const folder = sanitizeSlug(courseSlug);
  const roots = [
    path.join(env.uploadsDir, "images/cursos", folder),
    path.join(env.uploadsDir, "files/cursos", folder),
    path.join(env.uploadsDir, "tareas", folder),
  ];

  await Promise.all(
    roots.map(async (dir) => {
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore missing or unreadable directories.
      }
    }),
  );
}

export async function saveCourseAsset(
  courseSlug: string,
  kind: CourseAssetKind,
  file: Express.Multer.File,
  previousPath?: string | null,
): Promise<string> {
  const config = getKindConfig(kind);

  if (!config.mimeTypes.has(file.mimetype)) {
    throw new AppError(
      400,
      kind === "image"
        ? "Formato no permitido. Usa JPG, PNG, WEBP o GIF."
        : "Formato no permitido. Solo se aceptan archivos PDF.",
      "INVALID_FILE_TYPE",
    );
  }

  if (file.size > config.maxBytes) {
    throw new AppError(
      400,
      kind === "image"
        ? "La imagen es demasiado pesada. El máximo es 5 MB."
        : "El PDF es demasiado pesado. El máximo es 20 MB.",
      "FILE_TOO_LARGE",
    );
  }

  const folderSlug = sanitizeSlug(courseSlug);
  const directory = path.join(env.uploadsDir, config.subdir, folderSlug);
  await fs.mkdir(directory, { recursive: true });

  const originalName = file.originalname || `archivo${config.defaultExt}`;
  const filename = `${Date.now()}-${sanitizeFilename(originalName)}`;
  const absolutePath = path.join(directory, filename);

  await fs.writeFile(absolutePath, file.buffer);

  const publicPath = `/uploads/${config.subdir}/${folderSlug}/${filename}`;
  if (previousPath && previousPath !== publicPath) {
    await deleteManagedUpload(previousPath);
  }

  return publicPath;
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
  previousPath?: string | null,
): Promise<string> {
  if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(
      400,
      "Formato no permitido. Usa JPG, PNG, WEBP o GIF.",
      "INVALID_FILE_TYPE",
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new AppError(
      400,
      "La imagen es demasiado pesada. El máximo es 5 MB.",
      "FILE_TOO_LARGE",
    );
  }

  const folder = staffUploadFolder(staff);
  const directory = path.join(env.uploadsDir, "images/staff", folder);
  await fs.mkdir(directory, { recursive: true });

  const prefix = kind === "logo" ? "logo" : kind === "signature" ? "firma" : "foto";
  const originalName = file.originalname || `${prefix}.jpg`;
  const filename = `${prefix}-${Date.now()}-${sanitizeFilename(originalName)}`;
  const absolutePath = path.join(directory, filename);

  await fs.writeFile(absolutePath, file.buffer);

  const publicPath = `/uploads/images/staff/${folder}/${filename}`;
  if (previousPath && previousPath !== publicPath) {
    await deleteManagedUpload(previousPath);
  }

  return publicPath;
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
  previousPath?: string | null;
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

  const publicPath = `/uploads/tareas/${folderSlug}/${studentFolder}/${blockFolder}/${storedName}`;
  if (input.previousPath && input.previousPath !== publicPath) {
    await deleteManagedUpload(input.previousPath);
  }

  return {
    path: publicPath,
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
