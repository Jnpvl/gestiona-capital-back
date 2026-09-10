import path from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.API_URL ?? "http://localhost:3001";
const SLUG = "curso-prueba-componentes";
const STUDENT_EMAIL = "alumno.prueba@gestionach.com";
const STUDENT_PASSWORD = "alumno123";

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_ROOT = path.resolve(BACKEND_ROOT, "..");
const IMAGE_COVER = path.join(WORKSPACE_ROOT, "gestion-capital-front/public/images/hero.jpg");
const IMAGE_BLOCK = path.join(WORKSPACE_ROOT, "gestion-capital-front/public/images/logo.png");

function uuid() {
  return crypto.randomUUID();
}

function quizContent({ instructions, questions }) {
  return JSON.stringify({ instructions, questions });
}

function question(text, options, correctIndex) {
  return { id: uuid(), question: text, options, correctIndex };
}

function makePdf(title, lines) {
  const body = [title, "", ...lines].join("\\n");
  const escaped = body.replace(/[()\\]/g, "\\$&");
  const stream = `BT /F1 16 Tf 50 740 Td (${escaped}) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  return Buffer.from(`%PDF-1.4\n${objects.join("\n")}\ntrailer << /Root 1 0 R >>\n%%EOF\n`);
}

async function request(path, { method = "GET", token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.error?.message ?? data?.message ?? text ?? response.statusText;
    throw new Error(`${method} ${path} → ${response.status}: ${message}`);
  }

  return data;
}

async function upload(token, courseId, kind, filename, buffer, mime) {
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", new Blob([buffer], { type: mime }), filename);
  return request(`/api/admin/uploads/course/${courseId}`, { method: "POST", token, form });
}

const token = (
  await request("/api/auth/staff/login", {
    method: "POST",
    body: { email: "admin@gestionach.com", password: "admin123" },
  })
).token;

if (!token) throw new Error("No se pudo iniciar sesión como admin");

const existingCourses = await request(`/api/admin/courses?search=${SLUG}&limit=50`, { token });
let course = (existingCourses.items ?? existingCourses.courses ?? []).find((item) => item.slug === SLUG);

if (!course) {
  course = (
    await request("/api/admin/courses", {
      method: "POST",
      token,
      body: { title: "Curso de prueba — todos los componentes", slug: SLUG },
    })
  ).course;
}

const fs = await import("node:fs/promises");
const cover = await fs.readFile(IMAGE_COVER);
const logo = await fs.readFile(IMAGE_BLOCK);
const slides = makePdf("Presentacion NOM-035", [
  "Modulo 1: Identificacion de riesgos psicosociales.",
  "Usa esta presentacion como material de apoyo.",
]);
const guia = makePdf("Guia de estudio", [
  "1. Lee el marco legal.",
  "2. Resuelve el quiz con 80% o mas.",
  "3. Entrega la tarea obligatoria.",
  "4. Presenta el examen final.",
]);
const formato = makePdf("Formato de evidencia", [
  "Nombre del alumno:",
  "Fecha:",
  "Describe una accion preventiva en tu centro de trabajo.",
]);

const [coverUpload, imageUpload, slidesUpload, guiaUpload, formatoUpload] = await Promise.all([
  upload(token, course.id, "image", "portada.jpg", cover, "image/jpeg"),
  upload(token, course.id, "image", "logo.png", logo, "image/png"),
  upload(token, course.id, "pdf", "presentacion.pdf", slides, "application/pdf"),
  upload(token, course.id, "pdf", "guia.pdf", guia, "application/pdf"),
  upload(token, course.id, "pdf", "formato-tarea.pdf", formato, "application/pdf"),
]);

const practiceQuiz = quizContent({
  instructions:
    "Responde las siguientes preguntas. Necesitas al menos 80% (4 de 5) para aprobar y poder continuar.",
  questions: [
    question("NOM-035 regula principalmente:", [
      "Factores de riesgo psicosocial en el trabajo",
      "Ruido industrial",
      "Sustancias químicas",
      "Trabajo en alturas",
    ], 0),
    question("¿Cuál es la calificación mínima para aprobar un quiz en esta plataforma?", [
      "60%",
      "70%",
      "80%",
      "100%",
    ], 2),
    question("Una evidencia de la identificación de riesgos puede ser:", [
      "Una encuesta o entrevista al personal",
      "Un recorte de periódico",
      "Una foto de vacaciones",
      "Un comprobante de domicilio",
    ], 0),
    question("El examen final se desbloquea cuando:", [
      "Se abre el curso",
      "Se aprueban los quizzes y las tareas obligatorias",
      "Se ve el primer video",
      "Se descarga la constancia",
    ], 1),
    question("Una medida preventiva ante carga de trabajo excesiva es:", [
      "Ignorar las quejas",
      "Redistribuir actividades y comunicar expectativas",
      "Aumentar horas extra sin aviso",
      "Eliminar descansos",
    ], 1),
  ],
});

const finalQuiz = quizContent({
  instructions: "Examen final. Debes obtener al menos 80% (4 de 5) para aprobar el curso.",
  questions: [
    question("El objetivo de NOM-035 es:", [
      "Prevenir factores de riesgo psicosocial y promover un entorno organizacional favorable",
      "Sustituir a la NOM-001",
      "Regular únicamente el teletrabajo",
      "Eliminar las evaluaciones de desempeño",
    ], 0),
    question("Para concluir este curso en línea se requiere:", [
      "Solo ver los videos",
      "Aprobar quizzes, tarea obligatoria y examen final",
      "Enviar un correo al instructor",
      "Pagar una constancia extra",
    ], 1),
    question("Una política de prevención debe:", [
      "Quedarse solo en un archivo interno",
      "Comunicarse al personal y aplicarse de forma consistente",
      "Aplicarse únicamente a gerentes",
      "Cambiar cada semana sin aviso",
    ], 1),
    question("Si una tarea obligatoria no está aprobada:", [
      "Se puede presentar el examen final",
      "No se puede presentar el examen final",
      "La constancia se emite igual",
      "El quiz se marca solo",
    ], 1),
    question("Un entorno organizacional favorable incluye:", [
      "Reconocimiento del trabajo y comunicación clara",
      "Jornadas indefinidas",
      "Falta de canales de denuncia",
      "Castigos públicos",
    ], 0),
  ],
});

await request(`/api/admin/courses/${course.id}/content`, {
  method: "PUT",
  token,
  body: {
    sections: [
      {
        id: uuid(),
        title: "1. Bienvenida y marco legal",
        sortOrder: 0,
        isFinalExam: false,
        lessons: [
          {
            id: uuid(),
            title: "Introducción al curso",
            sortOrder: 0,
            blocks: [
              {
                id: uuid(),
                type: "text",
                title: "Objetivo de la lección",
                content:
                  "Bienvenido al curso de prueba. Aquí verás todos los componentes: texto, video, imagen, presentación, archivo, quiz y tarea.\n\nPara poder presentar el examen final debes:\n1. Aprobar el quiz de práctica con 80% o más.\n2. Entregar la tarea obligatoria y esperar a que el instructor la marque como aprobada.",
                resourceUrl: null,
                sortOrder: 0,
              },
              {
                id: uuid(),
                type: "video",
                title: "Video de bienvenida",
                content: null,
                resourceUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
                sortOrder: 1,
              },
              {
                id: uuid(),
                type: "image",
                title: "Identidad del curso",
                content: null,
                resourceUrl: imageUpload.path,
                sortOrder: 2,
              },
            ],
          },
        ],
      },
      {
        id: uuid(),
        title: "2. Materiales de apoyo",
        sortOrder: 1,
        isFinalExam: false,
        lessons: [
          {
            id: uuid(),
            title: "Presentación y documentos",
            sortOrder: 0,
            blocks: [
              {
                id: uuid(),
                type: "presentation",
                title: "Presentación del módulo",
                content: null,
                resourceUrl: slidesUpload.path,
                sortOrder: 0,
              },
              {
                id: uuid(),
                type: "file",
                title: "Guía de estudio (PDF)",
                content: null,
                resourceUrl: guiaUpload.path,
                sortOrder: 1,
              },
            ],
          },
        ],
      },
      {
        id: uuid(),
        title: "3. Práctica",
        sortOrder: 2,
        isFinalExam: false,
        lessons: [
          {
            id: uuid(),
            title: "Quiz y tarea obligatoria",
            sortOrder: 0,
            blocks: [
              {
                id: uuid(),
                type: "quiz",
                title: "Quiz de práctica",
                content: practiceQuiz,
                resourceUrl: null,
                sortOrder: 0,
              },
              {
                id: uuid(),
                type: "assignment",
                title: "Entrega de evidencia",
                content: JSON.stringify({
                  instructions:
                    "Sube un PDF o imagen con tu evidencia. Esta tarea es obligatoria: debe aparecer como aprobada para desbloquear el examen final.",
                  required: true,
                }),
                resourceUrl: formatoUpload.path,
                sortOrder: 1,
              },
            ],
          },
        ],
      },
      {
        id: uuid(),
        title: "Examen final",
        sortOrder: 3,
        isFinalExam: true,
        lessons: [
          {
            id: uuid(),
            title: "Examen final",
            sortOrder: 0,
            blocks: [
              {
                id: uuid(),
                type: "quiz",
                title: "Examen final",
                content: finalQuiz,
                resourceUrl: null,
                sortOrder: 0,
              },
            ],
          },
        ],
      },
    ],
  },
});

await request(`/api/admin/courses/${course.id}/promotion`, {
  method: "PATCH",
  token,
  body: {
    title: "Curso de prueba — todos los componentes",
    slug: SLUG,
    shortDescription: "Curso demo para validar texto, video, imagen, presentación, archivo, quiz, tarea y examen final.",
    description:
      "Curso de prueba con todos los componentes de la plataforma. El quiz se aprueba con 80% y la tarea obligatoria debe estar aprobada antes del examen final.",
    coverImage: coverUpload.path,
    modality: "online",
    duration: "8 horas",
    level: "Básico",
    period: "Septiembre 2026",
    location: "En línea",
    stpsThematicAreaCode: "6100",
    highlights: [
      "Todos los bloques de contenido",
      "Quiz de práctica con 80%",
      "Tarea obligatoria",
      "Examen final bloqueado hasta cumplir requisitos",
    ],
    status: "published",
    showInCatalog: true,
    featured: false,
  },
});

const students = await request(`/api/admin/students?search=${encodeURIComponent(STUDENT_EMAIL)}&limit=20`, {
  token,
});
let student = (students.items ?? students.students ?? []).find(
  (item) => item.email?.toLowerCase() === STUDENT_EMAIL,
);

if (!student) {
  student = (
    await request("/api/admin/students", {
      method: "POST",
      token,
      body: {
        paternalLastName: "Prueba",
        maternalLastName: "Demo",
        firstNames: "Alumno",
        email: STUDENT_EMAIL,
        password: STUDENT_PASSWORD,
        phone: "6621234567",
        alumnoType: "particular",
        curp: "PRBA800101HDFRRN01",
        gender: "otro",
        age: 30,
        residenceLocation: "Hermosillo, Sonora",
        notes: "Alumno de prueba para el curso de componentes",
      },
    })
  ).student;
}

try {
  await request(`/api/admin/students/${student.id}/enrollments`, {
    method: "POST",
    token,
    body: {
      courseId: course.id,
      enrolledViaCompany: false,
      deliveryMode: "online",
    },
  });
} catch (error) {
  if (!String(error.message).includes("ENROLLMENT_EXISTS") && !String(error.message).includes("409")) {
    throw error;
  }
}

console.log(
  JSON.stringify(
    {
      courseId: course.id,
      slug: SLUG,
      classroom: `http://localhost:3000/mis-cursos/cursos/${SLUG}`,
      catalog: `http://localhost:3000/cursos/${SLUG}`,
      admin: `http://localhost:3000/admin/cursos/${course.id}`,
      student: { email: STUDENT_EMAIL, password: STUDENT_PASSWORD },
    },
    null,
    2,
  ),
);
