-- Progreso del alumno por inscripción
CREATE TABLE IF NOT EXISTS enrollment_progress (
  enrollment_id UUID PRIMARY KEY REFERENCES enrollments(id) ON DELETE CASCADE,
  last_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enrollment_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS block_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES lesson_blocks(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  score INTEGER,
  total_questions INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enrollment_id, block_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_enrollment ON lesson_progress (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_block_progress_enrollment ON block_progress (enrollment_id);
