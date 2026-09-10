import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer";
import { env } from "../config/env";
import { AppError } from "../errors/app-error";

export interface SendMailInput {
  to?: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: Attachment[];
}

function parseRecipients(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createTransport() {
  const user = env.mail.user.trim();
  const pass = env.mail.pass.replace(/\s+/g, "");

  if (!user || !pass) {
    throw new AppError(
      503,
      "El correo no está configurado. Revisa MAIL_USER y MAIL_PASS.",
      "MAIL_NOT_CONFIGURED",
    );
  }

  const isGmail = env.mail.host.includes("gmail.com");

  if (isGmail) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.port === 465,
    auth: { user, pass },
  });
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const to = parseRecipients(input.to ?? env.mail.to);
  if (to.length === 0) {
    throw new AppError(
      503,
      "No hay destinatarios de correo configurados (MAIL_TO).",
      "MAIL_TO_MISSING",
    );
  }

  const transporter = createTransport();

  // Brevo: MAIL_USER es login SMTP; MAIL_FROM debe ser un sender del dominio autenticado.
  const fromAddress =
    env.mail.from.trim() ||
    env.mail.to.trim() ||
    env.mail.user.trim();

  await transporter.sendMail({
    from: `"Gestiona Capital Humano" <${fromAddress}>`,
    to,
    replyTo: input.replyTo,
    subject: input.subject,
    text: input.text,
    html: input.html ?? input.text.replace(/\n/g, "<br>"),
    attachments: input.attachments,
  });
}

export async function verifyMailConnection(): Promise<void> {
  const transporter = createTransport();
  await transporter.verify();
}
