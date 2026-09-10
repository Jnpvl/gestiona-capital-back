-- Cursos (base para inscripciones)
DO $$ BEGIN
  CREATE TYPE course_status AS ENUM ('draft', 'published');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  status course_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses (slug);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses (status);

-- Campos adicionales en estudiantes
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS notes TEXT;

-- Inscripciones: estudiante ↔ curso (N a N)
DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM ('active', 'revoked', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments (status);
