import fs from "node:fs/promises";
import path from "node:path";
import type { Attachment } from "nodemailer";
import { env } from "../config/env";
import { renderEmailTemplate } from "./email-template.service";
import { sendMail } from "./mail.service";

const LOGO_CID = "gch-logo";
const LOGO_PATH = path.join(process.cwd(), "assets/templates/gch-logo.png");

function firstName(fullName: string): string {
  const token = fullName.trim().split(/\s+/)[0];
  return token || fullName.trim();
}

function frontendUrl(pathname: string): string {
  const base = env.frontendUrl.replace(/\/$/, "");
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

async function logoAttachment(): Promise<Attachment | null> {
  try {
    await fs.access(LOGO_PATH);
    return {
      filename: "gch-logo.png",
      path: LOGO_PATH,
      cid: LOGO_CID,
      contentDisposition: "inline",
    };
  } catch {
    return null;
  }
}

async function sendTemplatedEmail(input: {
  template: string;
  intendedTo: string;
  subject: string;
  greetingName: string;
  data?: Record<string, unknown>;
  attachments?: Attachment[];
}): Promise<void> {
  const overrideTo = env.mail.to.trim();
  const to = overrideTo || input.intendedTo;
  const logo = await logoAttachment();
  const greeting = input.greetingName.trim()
    ? `Hola, ${firstName(input.greetingName)}:`
    : "Hola:";

  const templateData: Record<string, unknown> = {
    logoCid: LOGO_CID,
    greeting,
    ...input.data,
  };

  const [html, text] = await Promise.all([
    renderEmailTemplate(input.template, templateData),
    renderEmailTemplate(`${input.template}.txt`, templateData),
  ]);

  await sendMail({
    to,
    subject: input.subject,
    text,
    html,
    attachments: [...(logo ? [logo] : []), ...(input.attachments ?? [])],
  });
}

export async function notifySafely(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    console.error("[mail] No se pudo enviar la notificación:", error);
  }
}

export async function sendStudentWelcomeEmail(input: {
  name: string;
  email: string;
  password: string;
}): Promise<void> {
  await sendTemplatedEmail({
    template: "student-welcome",
    intendedTo: input.email,
    subject: "Tus accesos para entrar a Mis cursos",
    greetingName: input.name,
    data: {
      kicker: "Bienvenida",
      title: "Ya eres parte de Gestiona Capital Humano",
      highlights: [
        { label: "Usuario", value: input.email },
        { label: "Contraseña", value: input.password },
      ],
      action: {
        label: "Entrar a Mis cursos",
        href: frontendUrl("/mis-cursos/login"),
      },
    },
  });
}

export async function sendCourseAccessEmail(input: {
  name: string;
  email: string;
  courseTitle: string;
  courseSlug: string;
}): Promise<void> {
  await sendTemplatedEmail({
    template: "course-access",
    intendedTo: input.email,
    subject: `Ya puedes empezar «${input.courseTitle}»`,
    greetingName: input.name,
    data: {
      kicker: "Inscripción",
      title: `Te inscribimos en ${input.courseTitle}`,
      courseTitle: input.courseTitle,
      highlights: [{ label: "Curso", value: input.courseTitle }],
      action: {
        label: `Abrir «${input.courseTitle}»`,
        href: frontendUrl(`/mis-cursos/cursos/${input.courseSlug}`),
      },
    },
  });
}

export async function sendAssignmentReviewedEmail(input: {
  name: string;
  email: string;
  courseTitle: string;
  courseSlug: string;
  assignmentTitle: string;
  approved: boolean;
  reviewerComment?: string | null;
}): Promise<void> {
  const assignment = input.assignmentTitle.trim() || "tu entrega";
  const comment = input.reviewerComment?.trim() || null;
  const quote = comment
    ? {
        label: input.approved ? "Comentario del instructor" : "Qué hay que corregir",
        text: comment,
      }
    : undefined;

  if (input.approved) {
    await sendTemplatedEmail({
      template: "assignment-approved",
      intendedTo: input.email,
      subject: `Tu instructor aprobó «${assignment}»`,
      greetingName: input.name,
      data: {
        kicker: "Revisión de tarea",
        title: "Tu entrega quedó aceptada",
        courseTitle: input.courseTitle,
        assignmentTitle: assignment,
        highlights: [
          { label: "Curso", value: input.courseTitle },
          { label: "Tarea", value: assignment },
          { label: "Resultado", value: "Aceptada" },
        ],
        quote,
        action: {
          label: "Continuar el curso",
          href: frontendUrl(`/mis-cursos/cursos/${input.courseSlug}`),
        },
      },
    });
    return;
  }

  await sendTemplatedEmail({
    template: "assignment-rejected",
    intendedTo: input.email,
    subject: `Hay que corregir «${assignment}»`,
    greetingName: input.name,
    data: {
      kicker: "Revisión de tarea",
      title: "Necesitamos que vuelvas a enviar tu evidencia",
      courseTitle: input.courseTitle,
      assignmentTitle: assignment,
      highlights: [
        { label: "Curso", value: input.courseTitle },
        { label: "Tarea", value: assignment },
        { label: "Resultado", value: "Pendiente de corrección" },
      ],
      quote,
      action: {
        label: "Corregir y volver a enviar",
        href: frontendUrl(`/mis-cursos/cursos/${input.courseSlug}`),
      },
    },
  });
}

export async function sendCourseCompletedEmail(input: {
  name: string;
  email: string;
  courseTitle: string;
  courseSlug: string;
  attachments: Attachment[];
}): Promise<void> {
  const hasFiles = input.attachments.length > 0;
  await sendTemplatedEmail({
    template: "course-completed",
    intendedTo: input.email,
    subject: `Felicidades, ya tienes tu constancia de «${input.courseTitle}»`,
    greetingName: input.name,
    data: {
      kicker: "Constancia",
      title: `Terminaste ${input.courseTitle}`,
      courseTitle: input.courseTitle,
      hasFiles,
      highlights: [
        { label: "Curso", value: input.courseTitle },
        {
          label: "Documentos",
          value: hasFiles
            ? input.attachments
                .map((file) => (typeof file.filename === "string" ? file.filename : "constancia.pdf"))
                .join(", ")
            : "Disponibles en Mis cursos",
        },
      ],
      action: {
        label: "Ver mis constancias",
        href: frontendUrl(`/mis-cursos/cursos/${input.courseSlug}`),
      },
    },
    attachments: input.attachments,
  });
}

export async function sendNewCourseAvailableEmail(input: {
  name: string;
  email: string;
  courseTitle: string;
  courseSlug: string;
}): Promise<void> {
  await sendTemplatedEmail({
    template: "new-course-available",
    intendedTo: input.email,
    subject: `Abrimos un curso nuevo: ${input.courseTitle}`,
    greetingName: input.name,
    data: {
      kicker: "Catálogo",
      title: `Ya está disponible «${input.courseTitle}»`,
      courseTitle: input.courseTitle,
      highlights: [{ label: "Curso nuevo", value: input.courseTitle }],
      action: {
        label: "Ver de qué se trata",
        href: frontendUrl(`/cursos/${input.courseSlug}`),
      },
    },
  });
}
