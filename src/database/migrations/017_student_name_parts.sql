ALTER TABLE students
  ADD COLUMN IF NOT EXISTS paternal_last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS maternal_last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS first_names VARCHAR(150);

UPDATE students
SET first_names = name
WHERE first_names IS NULL AND name IS NOT NULL;

UPDATE students
SET paternal_last_name = '—'
WHERE paternal_last_name IS NULL OR TRIM(paternal_last_name) = '';
