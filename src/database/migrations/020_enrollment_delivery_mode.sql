ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS delivery_mode VARCHAR(20) NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS enrollments_delivery_mode_check;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_delivery_mode_check
  CHECK (delivery_mode IN ('online', 'presencial'));
