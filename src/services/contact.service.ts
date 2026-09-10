import type { ContactMessageInput } from "../validators/contact.validator";
import { renderEmailTemplate } from "./email-template.service";
import { sendMail } from "./mail.service";

const SERVICE_LABELS: Record<string, string> = {
  "capital-humano": "Capital humano",
  capacitacion: "Capacitación y formación",
  seguridad: "Seguridad e higiene",
  cumplimiento: "Cumplimiento normativo",
  otro: "Otro",
};

export async function sendContactMessage(input: ContactMessageInput): Promise<void> {
  const servicio = SERVICE_LABELS[input.servicio] ?? (input.servicio || "No especificado");
  const data = {
    nombre: input.nombre,
    empresa: input.empresa || "—",
    email: input.email,
    telefono: input.telefono || "—",
    servicio,
    mensaje: input.mensaje,
  };

  const [html, text] = await Promise.all([
    renderEmailTemplate("contact-message", data),
    renderEmailTemplate("contact-message.txt", data),
  ]);

  await sendMail({
    subject: `Contacto: ${input.nombre}`,
    replyTo: input.email,
    text,
    html,
  });
}
