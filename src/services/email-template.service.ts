import fs from "node:fs/promises";
import path from "node:path";
import Handlebars from "handlebars";

const TEMPLATES_DIR = path.join(process.cwd(), "assets/email-templates");
const PARTIALS_DIR = path.join(TEMPLATES_DIR, "partials");

const compiledCache = new Map<string, Handlebars.TemplateDelegate>();
let partialsReady: Promise<void> | null = null;

async function registerPartials(): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(PARTIALS_DIR);
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((name) => name.endsWith(".hbs"))
      .map(async (name) => {
        const source = await fs.readFile(path.join(PARTIALS_DIR, name), "utf8");
        Handlebars.registerPartial(name.replace(/\.hbs$/, ""), source);
      }),
  );
}

async function ensurePartials(): Promise<void> {
  if (!partialsReady) {
    partialsReady = registerPartials().catch((error) => {
      partialsReady = null;
      throw error;
    });
  }
  await partialsReady;
}

async function compileTemplate(relativeName: string): Promise<Handlebars.TemplateDelegate> {
  await ensurePartials();

  const cached = compiledCache.get(relativeName);
  if (cached) return cached;

  const absolutePath = path.join(TEMPLATES_DIR, relativeName);
  const source = await fs.readFile(absolutePath, "utf8");
  const compiled = Handlebars.compile(source, { noEscape: false, strict: false });
  compiledCache.set(relativeName, compiled);
  return compiled;
}

/** Render a Handlebars template from assets/email-templates. */
export async function renderEmailTemplate(
  name: string,
  data: Record<string, unknown>,
): Promise<string> {
  const fileName = name.endsWith(".hbs") ? name : `${name}.hbs`;
  const template = await compileTemplate(fileName);
  return template(data).trim();
}

export function clearEmailTemplateCache(): void {
  compiledCache.clear();
  partialsReady = null;
}
