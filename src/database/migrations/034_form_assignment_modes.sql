-- Modo por guía en cada asignación:
--   admin_applied = la aplica el admin (el empleado nunca la ve)
--   self          = la contesta el empleado desde su portal (Mis cursos)
-- Guía V no usa modo (solo admin/Excel). Clave ausente = admin_applied.
ALTER TABLE form_assignments
  ADD COLUMN IF NOT EXISTS form_modes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Asignaciones existentes: todas como admin_applied (explícito).
UPDATE form_assignments a
   SET form_modes = sub.modes
  FROM (
    SELECT id, COALESCE(jsonb_object_agg(k, 'admin_applied') FILTER (WHERE k <> 'nom035_guia5'), '{}'::jsonb) AS modes
      FROM form_assignments CROSS JOIN UNNEST(form_keys) AS k
     GROUP BY id
  ) sub
 WHERE sub.id = a.id AND a.form_modes = '{}'::jsonb;
