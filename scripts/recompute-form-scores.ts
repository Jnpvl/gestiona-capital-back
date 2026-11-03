/**
 * Recalcula la calificación guardada de todas las respuestas completas (Guías I/II/III).
 * Uso: npx tsx scripts/recompute-form-scores.ts
 */
import "dotenv/config";
import { pool } from "../src/config/database";
import { findAllCompletedResponses, updateFormResponseScore } from "../src/repositories/form.repository";
import { FORM_DEFINITIONS, isFormKey, scoreForm } from "../src/shared/forms";

async function main() {
  const rows = await findAllCompletedResponses();
  let updated = 0;
  for (const row of rows) {
    if (!isFormKey(row.formKey)) continue;
    await updateFormResponseScore(row.id, scoreForm(FORM_DEFINITIONS[row.formKey], row.answers));
    updated += 1;
  }
  console.log(`Respuestas completas: ${rows.length}. Recalculadas: ${updated}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
