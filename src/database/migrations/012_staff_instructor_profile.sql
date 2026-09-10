ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS paternal_last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS maternal_last_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS first_names VARCHAR(150),
  ADD COLUMN IF NOT EXISTS age SMALLINT,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ace_stps_registration VARCHAR(100),
  ADD COLUMN IF NOT EXISTS renap_conocer VARCHAR(100),
  ADD COLUMN IF NOT EXISTS professional_license VARCHAR(50),
  ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS career VARCHAR(255),
  ADD COLUMN IF NOT EXISTS professional_area VARCHAR(255),
  ADD COLUMN IF NOT EXISTS professional_bio TEXT;

UPDATE staff
SET first_names = name
WHERE first_names IS NULL AND name IS NOT NULL;

UPDATE staff
SET paternal_last_name = '—'
WHERE paternal_last_name IS NULL;
