-- Contenido promocional estructurado (perfil, objetivos, temario)
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS participant_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS objectives JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS syllabus JSONB NOT NULL DEFAULT '[]'::jsonb;
