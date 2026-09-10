-- Secciones dentro de un curso (módulos / unidades)
CREATE TABLE IF NOT EXISTS course_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_sections_course ON course_sections (course_id, sort_order);

-- Las clases pertenecen a una sección
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES course_sections(id) ON DELETE CASCADE;

-- Migrar clases existentes a una sección por defecto
INSERT INTO course_sections (course_id, title, sort_order)
SELECT DISTINCT l.course_id, 'Sección 1', 0
FROM lessons l
WHERE l.course_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM course_sections cs WHERE cs.course_id = l.course_id
  );

UPDATE lessons l
SET section_id = cs.id
FROM course_sections cs
WHERE l.course_id = cs.course_id
  AND l.section_id IS NULL;

ALTER TABLE lessons DROP COLUMN IF EXISTS course_id;
DROP INDEX IF EXISTS idx_lessons_course;

ALTER TABLE lessons ALTER COLUMN section_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_section ON lessons (section_id, sort_order);
