CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  modality VARCHAR(100) NOT NULL,
  date_label VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_public
  ON events (is_visible, status, sort_order ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_admin
  ON events (sort_order ASC, created_at DESC);

-- Semilla: eventos actuales del sitio (solo si la tabla está vacía)
INSERT INTO events (title, event_type, modality, date_label, description, status, is_visible, sort_order)
SELECT * FROM (
  VALUES
    (
      'Factores de Riesgo Psicosocial — NOM-035',
      'Capacitación',
      'Presencial / Híbrido',
      'Próximamente',
      'Programa práctico orientado a comprender, identificar y atender los factores de riesgo psicosocial, así como fortalecer el cumplimiento de las disposiciones aplicables de la NOM-035-STPS.',
      'published',
      TRUE,
      0
    ),
    (
      'Liderazgo y Gestión de Equipos',
      'Taller',
      'Presencial / En línea',
      'Próximamente',
      'Desarrolla competencias para liderar equipos de manera efectiva, fortaleciendo la comunicación, la colaboración, la toma de decisiones y el desempeño.',
      'published',
      TRUE,
      1
    ),
    (
      'Cumplimiento Laboral y STPS',
      'Conferencia',
      'En línea',
      'Próximamente',
      'Conoce los principales requerimientos de la legislación laboral mexicana y las obligaciones aplicables ante la STPS, con un enfoque práctico para facilitar su comprensión e implementación.',
      'published',
      TRUE,
      2
    )
) AS seed(title, event_type, modality, date_label, description, status, is_visible, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM events LIMIT 1);
