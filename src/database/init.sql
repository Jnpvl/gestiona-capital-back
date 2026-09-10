-- ============================================================
-- Gestiona Capital Humano — Inicialización de base de datos
-- Ejecutar en la base "capital" (PostgreSQL)
-- ============================================================

-- Staff: administradores y maestros
DO $$ BEGIN
  CREATE TYPE staff_role AS ENUM ('super_admin', 'admin', 'teacher');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role staff_role NOT NULL DEFAULT 'teacher',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_email ON staff (email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff (role);

-- Estudiantes (tabla separada)
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_email ON students (email);

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

ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE students ADD COLUMN IF NOT EXISTS notes TEXT;

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

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS created_by_staff_id UUID NULL REFERENCES staff(id) ON DELETE SET NULL;

-- Admin inicial
-- Email: admin@gestionach.com
-- Password: admin123
INSERT INTO staff (name, email, password_hash, role)
VALUES (
  'Administrador',
  'admin@gestionach.com',
  '$2b$12$KFpFBck8ZiOzy/r757lPfue3Q49vWZH9mdAMLeM94alZ3QtViCZgK',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
