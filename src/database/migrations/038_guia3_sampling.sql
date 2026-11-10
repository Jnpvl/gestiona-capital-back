-- Muestreo opcional de Guía III (censo vs muestra representativa NOM-035).
-- Estructura por clave de guía, p. ej.:
-- {
--   "nom035_guia3": {
--     "mode": "sample",
--     "populationN": 120,
--     "sampleN": 92,
--     "stratumField": "sexo",
--     "selectedStudentIds": ["…"]
--   }
-- }
ALTER TABLE form_assignments
  ADD COLUMN IF NOT EXISTS sampling JSONB NOT NULL DEFAULT '{}'::jsonb;
