-- Campos promocionales en cursos
ALTER TABLE courses ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS modality VARCHAR(50);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS duration VARCHAR(100);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS level VARCHAR(100);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS highlights JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS show_in_catalog BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_courses_featured ON courses (featured) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_courses_catalog ON courses (show_in_catalog, status);

-- Clases dentro de un curso
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons (course_id, sort_order);

-- Bloques de contenido por clase
DO $$ BEGIN
  CREATE TYPE lesson_block_type AS ENUM ('video', 'text', 'presentation', 'quiz', 'file');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS lesson_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type lesson_block_type NOT NULL,
  title VARCHAR(255),
  content TEXT,
  resource_url VARCHAR(500),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_blocks_lesson ON lesson_blocks (lesson_id, sort_order);
